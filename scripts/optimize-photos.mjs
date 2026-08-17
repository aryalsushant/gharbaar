/**
 * Normalise the household photos in public/people/.
 *
 * These ship inside the app bundle, so a 4MB photo straight off a phone is 4MB
 * every housemate downloads before they can see who is cooking. This trims,
 * squares, resizes to 512 and writes one lowercase .jpg per person.
 *
 * Lowercase matters beyond tidiness: Windows finds suwan.JPG when the app asks
 * for suwan.jpg and Linux does not, so a photo that works locally would 404 for
 * everyone once deployed.
 *
 *   npm run photos
 *
 * Safe to run repeatedly. Originals are kept in public/people/originals/ and are
 * always preferred as the source, so re-running never re-compresses an already
 * compressed file. That folder is gitignored and never reaches the bundle.
 */
import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const KEYS = ['suwan', 'prastab', 'sushant', 'serene', 'chetan', 'bipul'];
const SIZE = 512;
const DIR = 'public/people';
const BACKUP = path.join(DIR, 'originals');
const IMAGE = /\.(jpe?g|png|webp|heic)$/i;

/**
 * Per-person corrections, because "square crop of the interesting bit" gets two
 * of these wrong.
 *
 *   region: take this horizontal band of the original first, as fractions of
 *           its height. For screenshots with player bars or status bars that
 *           trim cannot see as borders.
 *   zoom:   crop tighter than the square. 1.5 keeps two thirds of the frame,
 *           for photos taken from across a room.
 *   focus:  where the tighter crop sits, 0 to 1. Only applies with zoom.
 *           Defaults to x 0.5, y 0.3, since heads sit above the middle of a
 *           portrait and a centred window shaves the top of the head off.
 */
const TWEAKS = {
  // Shot from a distance and standing left of centre.
  bipul: { zoom: 1.5, focus: { x: 0.1, y: 0.26 } },
};

await mkdir(BACKUP, { recursive: true });

const find = (files, key) =>
  files.find(
    (name) => path.parse(name).name.toLowerCase().replace(/-original$/, '') === key && IMAGE.test(name)
  );

/**
 * Phone screenshots arrive letterboxed, and a square crop of one keeps the black
 * band. Trim it, but only when what is left is still most of the picture: a
 * photo shot against a plain wall can otherwise be trimmed down to a face and a
 * shoulder.
 */
async function trimmed(input) {
  const base = sharp(input);
  const { width, height } = await base.metadata();
  try {
    const cut = await sharp(input).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
    const kept = (cut.info.width * cut.info.height) / (width * height);
    if (kept > 0.35) return cut.data;
  } catch {
    // Trim throws when the whole image is one colour. Nothing to do about that.
  }
  return input;
}

const backups = await readdir(BACKUP).catch(() => []);
let changed = 0;

for (const key of KEYS) {
  const current = await readdir(DIR);
  const fromBackup = find(backups, key);
  const source = fromBackup
    ? path.join(BACKUP, fromBackup)
    : find(current, key)
      ? path.join(DIR, find(current, key))
      : null;

  if (!source) {
    console.log(`--   ${key}: no photo yet`);
    continue;
  }

  const target = path.join(DIR, `${key}.jpg`);

  const tweak = TWEAKS[key] ?? {};
  let input = await trimmed(source);

  if (tweak.region) {
    const upright = await sharp(input).rotate().toBuffer();
    const meta = await sharp(upright).metadata();
    input = await sharp(upright)
      .extract({
        left: 0,
        top: Math.round(meta.height * tweak.region.top),
        width: meta.width,
        height: Math.round(meta.height * tweak.region.height),
      })
      .toBuffer();
  }

  const zoom = tweak.zoom ?? 1;
  const box = Math.round(SIZE * zoom);

  let pipeline = sharp(input)
    .rotate() // honour the EXIF orientation phones set, then drop it
    .resize(box, box, { fit: 'cover', position: 'attention' });

  if (zoom > 1) {
    const excess = box - SIZE;
    const focus = tweak.focus ?? { x: 0.5, y: 0.3 };
    pipeline = sharp(await pipeline.toBuffer()).extract({
      left: Math.min(excess, Math.max(0, Math.round(excess * focus.x))),
      top: Math.min(excess, Math.max(0, Math.round(excess * focus.y))),
      width: SIZE,
      height: SIZE,
    });
  }

  const optimised = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

  // Keep the untouched original the first time we see one.
  if (!fromBackup && !source.startsWith(BACKUP)) {
    await rename(source, path.join(BACKUP, path.basename(source)));
  }

  await writeFile(target, optimised);
  console.log(`ok   ${key}: ${path.basename(source)} -> ${key}.jpg`);
  changed++;
}

console.log(`\n${changed} photo${changed === 1 ? '' : 's'} normalised. Originals in ${BACKUP}.`);

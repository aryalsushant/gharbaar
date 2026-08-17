/**
 * Normalise the household photos in public/people/.
 *
 * These ship inside the app bundle, so a 4MB photo straight off a phone is 4MB
 * every housemate downloads before they can see who is cooking. This squares
 * them, resizes to 512, and writes a single lowercase .jpg per person.
 *
 * Lowercase matters beyond tidiness: Windows finds suwan.JPG when the app asks
 * for suwan.jpg, and Linux does not, so a photo that works locally would 404
 * for everyone once deployed.
 *
 *   node scripts/optimize-photos.mjs
 *
 * Originals are moved to public/people/originals/ rather than deleted, and that
 * folder is gitignored so it never reaches the bundle.
 */
import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const KEYS = ['suwan', 'prastab', 'sushant', 'serene', 'chetan', 'bipul'];
const SIZE = 512;
const DIR = 'public/people';
const BACKUP = path.join(DIR, 'originals');

const files = await readdir(DIR, { withFileTypes: true });
await mkdir(BACKUP, { recursive: true });

let changed = 0;

for (const key of KEYS) {
  const source = files.find(
    (file) =>
      file.isFile() &&
      path.parse(file.name).name.toLowerCase() === key &&
      /\.(jpe?g|png|webp|heic)$/i.test(file.name)
  );

  if (!source) {
    console.log(`--   ${key}: no photo yet`);
    continue;
  }

  const from = path.join(DIR, source.name);
  const target = path.join(DIR, `${key}.jpg`);

  // Read fully before writing, since the target can be the source file itself.
  const optimised = await sharp(from)
    .rotate() // honour the EXIF orientation phones set, then drop it
    .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  if (source.name !== `${key}.jpg`) {
    await rename(from, path.join(BACKUP, source.name));
  } else {
    await rename(from, path.join(BACKUP, `${key}-original.jpg`));
  }

  await writeFile(target, optimised);
  console.log(`ok   ${key}: ${source.name} -> ${key}.jpg`);
  changed++;
}

console.log(`\n${changed} photo${changed === 1 ? '' : 's'} normalised. Originals in ${BACKUP}.`);

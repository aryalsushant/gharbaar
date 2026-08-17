# Photos

Drop one file per person here, named after their roster key, then run:

```sh
npm run photos
```

That squares each photo, resizes it to 512px, re-encodes it as a lowercase
`.jpg`, and bakes in the EXIF rotation so portrait shots are not sideways. Your
originals move to `originals/`, which is gitignored.

Any format works going in: `.jpg`, `.jpeg`, `.png`, `.webp`, upper or lower
case. Straight off a phone is fine, no resizing first.

```
suwan  prastab  sushant  serene  chetan  bipul
```

Two things the script exists to prevent. These images ship inside the app
bundle, so a 4MB photo is 4MB every housemate downloads before they can see who
is cooking. And the app requests a lowercase `.jpg`, which Windows will find as
`Suwan.JPG` while Linux will not, so an un-normalised photo works locally and
404s once deployed.

Anyone without a photo falls back to their initials on a disc tinted from their
name, so add them one at a time as people send them.

The roster keys are fixed in the first migration and are always lowercase.

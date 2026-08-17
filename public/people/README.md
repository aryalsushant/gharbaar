# Photos

Drop one file per person in this folder, named after their roster key:

```
suwan.jpg
prastab.jpg
sushant.jpg
serene.jpg
chetan.jpg
bipul.jpg
```

`.png` works too. Anything missing falls back to initials on a tinted disc, so
you can add them one at a time as people send them and nothing looks broken in
the meantime.

Square images are best, since they are displayed in a circle and anything else
gets cropped to the centre. Around 400px square is plenty: they are never shown
larger than about 80px, and these ship inside the app bundle, so a 4MB photo
straight off a phone makes the whole app slower to load for everyone. Resize
before dropping them in.

The roster keys are fixed in the first migration and are always lowercase.

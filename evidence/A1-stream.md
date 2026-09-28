# A1 — Streaming Sound (SoundStreamHead2) — partial O11 evidence

Task: A1 — Decompile and Export Reference Build
Started: 2026-09-28T12:31:22Z
Ended: 2026-09-28T12:45:03Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `artifacts/tools/ffdec/ffdec.sh -dumpSWF "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" > artifacts/decompiled/tags.txt`
- `artifacts/tools/ffdec/ffdec.sh -format script:as,shape:svg,sprite:svg,image:png,sound:mp3_wav,text:plain,font:ttf -export script,shape,sprite,image,sound,text,font artifacts/decompiled/ "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf"`
- `python3 artifacts/tools/a1-swf-inspect.py "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" > artifacts/decompiled/swf-inspect.json`
- stream detail dump + `afinfo artifacts/decompiled/sounds/-1.wav`: see `evidence/logs/A1-stream-details.log`
Exit codes: 0 (all)
Output summary: 38 SoundStreamHead2 tags parsed; zero SoundStreamBlock tags; stream export is an empty WAV
Artifact SHA-256 hashes: `sounds/-1.wav` `ae8cd4d87061de84b556826a36ea6e209689ff2bb3632b9ac121aa34a5338a6c`
Result: PASS

---

## 1. Findings (2012 build, raw tag data)

- `SoundStreamHead2` (tag 45): **38 tags total** — 1 top-level (tag #2 in `tags.txt`) and
  37 nested, one inside each `DefineSprite` (37 sprites).
- Every one of the 38 tags has the **identical 4-byte payload** `0a 00 00 00`:

| Field | Value | Meaning |
|---|---|---|
| PlaybackSoundRate | 2 | 22,050 Hz |
| PlaybackSoundSize | 1 | 16-bit |
| PlaybackSoundType | 0 | mono |
| StreamSoundCompression | 0 | uncompressed |
| StreamSoundRate | 0 | 5,512 Hz field value (never used) |
| StreamSoundSize | 0 | 8-bit field value (never used) |
| StreamSoundType | 0 | mono |
| StreamSoundSampleCount | **0** | no streamed samples |

- `SoundStreamHead` (tag 18): **0 tags** in the file.
- `SoundStreamBlock` (tag 19, the tag that would carry streamed audio data):
  **0 tags in the entire SWF** (`grep -c SoundStreamBlock tags.txt` = 0).
- Parsed values above agree between the raw binary parse and FFDec's `tags.xml`
  (`SoundStreamHead2Tag` attributes: `streamSoundCompression="0"`,
  `streamSoundSampleCount="0"` for all 38 occurrences).

## 2. Export

FFDec's sound export produced exactly one stream-related file:
`artifacts/decompiled/sounds/-1.wav` — a 44-byte RIFF/WAVE header with a zero-length
`data` chunk (`data` size 0):

```text
00000000: 5249 4646 2400 0000 5741 5645 666d 7420  RIFF$...WAVEfmt
00000010: 1000 0000 0100 0100 8815 0000 102b 0000  .............+..
00000020: 0200 1000 6461 7461 0000 0000            ....data....
```

`afinfo` on it: exit 0, `WAVE`, 1 ch, 5512 Hz, Int16, `audio bytes: 0`,
`estimated duration: 0.000000 sec`. The stream-head ID reported by FFDec is `-1`
(there is no DefineSound character for it).

## 3. Conclusion

**The 2012 reference build contains no streaming-sound content.** The 38
`SoundStreamHead2` tags are empty stream declarations (sample count 0) with no
`SoundStreamBlock` data anywhere; playback uses the 9 `DefineSound` MP3s
(see `A1-export-manifest.md` §6–§7) plus timeline `StartSound` tags (9 of them).
Nothing in the stream needs to be mapped to a sound event. Whether the live Ruffle
run ever attempts to play anything from this stream head must be confirmed in the
reference harness (A2/A3), so the item stays OPEN.

## 4. O11 partial finding (item stays OPEN)

See `evidence/A1-export-manifest.md` §11 "docs/08 proposal" for the exact proposed note.
Summary: content = none (0 samples, 0 `SoundStreamBlock` tags, empty WAV export); the
tag is an authoring/tooling placeholder. Purpose classification (and audible confirmation)
remains with A2/A3.

## 5. Result

**PASS** — stream blocks extracted/inspected: 38 identical empty stream heads, zero
stream blocks, empty 44-byte WAV export verified with `afinfo`.
Raw logs: `evidence/logs/A1-stream-details.log`, `evidence/logs/A1-tags.log`.

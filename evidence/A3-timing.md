# A3 — Timing Catalog (evidence)

Task: A3 — Layout and Timing Catalog
Started: 2026-09-28T12:49:36Z
Ended: 2026-09-28T13:51:16Z
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host
Commands executed (exact): see `evidence/A3-layout.md` §2 (steps 3, 7, 17, 20, 22, 24) and the raw logs
Exit codes: 0 (`A3-make-animation.log`, `A3-verify.log`, `A3-v3-layout.log`)
Output summary: `data/animation.json` — fps 36, total 241 frames, 24 sequences with numeric frame spans, `durationSec = frames / fps`, keyframe frames/offsets per docs/07 §4
Artifact SHA-256 hashes: `data/animation.json` = `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e`; inputs listed in `evidence/A3-layout.md` §9
Result: PASS

---

## 1. FPS and frame grid (O07)

| Fact | Value | Source |
|---|---|---|
| Frame rate | **36.0 fps** | `artifacts/decompiled/header.txt` (`frameRate=36`), `swf-inspect.json` (`frameRate: 36.0`), FLA `DOMDocument.xml` (`frameRate="36"`), tags.xml (`frameRate="36.0"`) |
| Total frames | **241** | `header.txt` `frameCount=241`; 241 `ShowFrame` tags in `tags.xml`; FLA frameCount 241 |
| Stage | 550 × 400 px | `header.txt` / `swf-inspect.json` |
| Duration of one frame | `1/36 s = 0.02778 s` | derived |
| Frame numbering used in data files | **1-based SWF frames** (FLA `DOMFrame index + 1`) | defined in `data/animation.json.frameNumbering` |

Frame-label anchors (`tags.xml` `FrameLabel`, FLA agrees; docs/02 §5):
`main` = frame 5, `preall` = frame 130, `hepsiburda` = **frame 131** (gameplay/round
controller), `bravo` = frame 132 (celebration); the timeline stops at frame 241.

Sprite-internal frame labels exist for `wordball` (`gizle`/`getir`/`gotur`/`getir1`/
`gotur1`), `status` (`st`/`on`/`off`) and the `DefineEditText` states — they are
relative to the sprite timelines and are listed with the sprite sequence rows below.

## 2. Shape of `data/animation.json` (no schema exists — chosen shape documented here)

```json
{
  "schemaVersion": 1,
  "fps": 36,
  "totalFrames": 241,
  "frameNumbering": "1-based SWF frame numbers (FLA DOMFrame index + 1)",
  "durationFormula": "durationSec = frames / fps",
  "source": "artifacts/decompiled/header.txt (frameRate=36, frameCount=241); artifacts/decompiled/tags.xml (FrameLabel/PlaceObject2/ShowFrame)",
  "sequences": [
    {
      "id": "<slug>",                       // unique, A3-assigned, no canonical names exist upstream
      "kind": "main-timeline | element-motion | sprite-timeline",
      "state": "preloader | intro | board | win | sprite-internal",
      "elements": ["<data/layout.json id>", …],   // non-empty; ids exist in the layout catalog
      "frameStart": n, "frameEnd": n, "frames": n,
      "durationSec": n / 36,
      "keyframeFrames": [n, …],             // absolute SWF frames for main-timeline/element-motion,
                                            // relative sprite frames 1..N for sprite-timeline
      "keyframeOffsetsSec": [n/36, …],      // (frame − frameStart) / fps
      "evidence": "<extraction source + span proof>"
    }
  ]
}
```

Every field is present and non-empty for every sequence (`a3-verify.py` V2c checks
that numerically; log `A3-verify.log`). There is no empty field anywhere in the file.
Keyframe offsets follow docs/07 §4 ("keyframe screenshots at the offsets defined in
`data/animation.json`") and are the five evenly spaced capture points
start/25 %/50 %/75 %/end of each span (deduplicated when a span has <5 frames).

## 3. Sequences (24)

Frame spans are inclusive; `frames = frameEnd − frameStart + 1`;
`duration = frames / 36`. Generated from `tags.xml` by
`artifacts/a3-captures/tools/make_animation.py`; raw run `A3-make-animation.log`.

### 3.1 Main timeline states

| id | frames (1-based) | frames | duration | keyframe frames | keyframe offsets | elements |
|---|---|---|---|---|---|---|
| `preloader` | 1–4 | 4 | 0.1111 s | 1,2,3,4 | 0.0000, 0.0278, 0.0556, 0.0833 | 11 elements placed by frame 4 (intro backdrop/logo/sky/ground/layer3, progress bar, 5 preloader fields) |
| `intro` | 5–130 | 126 | 3.5000 s | 5,36,68,99,130 | 0.0000, 0.8611, 1.7500, 2.6111, 3.4722 | 18 elements on stage during the intro (incl. 10 sound clips, glow, falling logo, wordball template) |
| `board` | 131–131 | 1 | 0.0278 s | 131 | 0.0000 | 51 elements on stage (board backdrop, sockets/buttons, right panel, result templates, 10 sound clips) |
| `win` | 132–241 | 110 | 3.0556 s | 132,159,186,214,241 | 0.0000, 0.7500, 1.5000, 2.2778, 3.0278 | 9 elements; `hiscore_form` rises at 222–241, `bottom_marquee` appears at 241 |

### 3.2 Element motion (main-timeline `Move` tags)

| id | element | frames | moves | duration | keyframes |
|---|---|---|---|---|---|
| `intro_glow_motion` | `intro_glow` (ch20, depth 7) | 5–222 | 214 | 6.0556 s | 5, 59, 114, 168, 222 |
| `intro_logo_motion` | `intro_logo` (ch29, depth 47) | 41–202 | 86 | 4.5000 s | 41, 81, 122, 162, 202 |
| `hiscore_form_motion` | `hiscore_form` (ch166, depth 51) | 222–241 | 19 | 0.5556 s | 222, 227, 232, 236, 241 |

### 3.3 Sprite-internal timelines (relative frames 1..N)

| id | sprite | frames | duration | on-stage main-timeline span |
|---|---|---|---|---|
| `sprite_preloader_progress_timeline` | ch12 | 2 | 0.0556 s | 5–130 |
| `sprite_clip_timerr_timeline` | ch21 | 4 | 0.1111 s | 5–131 |
| `sprite_clip_enter_timeline` | ch23 | 11 | 0.3056 s | 16–131 |
| `sprite_clip_shuffle_timeline` | ch25 | 29 | 0.8056 s | 26–131 |
| `sprite_clip_countdown_timeline` | ch27 | 4 | 0.1111 s | 36–131 |
| `sprite_clip_boing_timeline` | ch31 | 12 | 0.3333 s | 46–131 |
| `sprite_clip_fanfare_timeline` | ch33 | 12 | 0.3333 s | 56–131 |
| `sprite_clip_finishsound_timeline` | ch35 | 5 | 0.1389 s | 66–131 |
| `sprite_clip_typer_timeline` | ch37 | 7 | 0.1944 s | 76–131 |
| `sprite_clip_backspace_timeline` | ch39 | 11 | 0.3056 s | 109–131 |
| `sprite_clip_buzz_timeline` | ch41 | 15 | 0.4167 s | 119–131 |
| `sprite_wordball_timeline` | ch46 | 39 | 1.0833 s | 119–131 (template; matches are code-duplicated) |
| `sprite_timer_bar_timeline` | ch76 | 2 | 0.0556 s | 131–131 |
| `sprite_loading_banner_timeline` | ch84 | 4 | 0.1111 s | 131–131 |
| `sprite_score_feedback_timeline` | ch111 | 37 | 1.0278 s | 131–131 |
| `sprite_status_ball_timeline` | ch123 | 3 | 0.0833 s | 131–131 |
| `sprite_bottom_marquee_timeline` | ch170 | 65 | 1.8056 s | 241–241 |

## 4. Derivation and verification

- Spans derive from `PlaceObject2` start / `RemoveObject2` end (1-based conversion
  `frame + 1`, see `parse_main_timeline.py`) and from `DefineSprite frameCount`
  (`tags.xml`).
- `a3-verify.py` V2c checks: numeric fps; every sequence has numeric
  `frameStart/frameEnd/frames/durationSec`; `frames == frameEnd − frameStart + 1`;
  `|durationSec − frames/36| ≤ 0.0005`; non-empty `keyframeFrames` and
  `keyframeOffsetsSec` of equal length inside the span; every `elements` id exists in
  `data/layout.json`; no empty string fields. Result: PASS (`A3-verify.log`).
- Cross-consistency (V2d): `fps == header frameRate == 36`,
  `totalFrames == header frameCount == 241`, stage 550×400 with background
  `#ffffff` (SetBackgroundColor) — PASS.

## 5. Boundaries of this catalog (not invented)

- Code-driven transitions without their own frame spans are **not** listed as
  sequences (they are behavior, owned by the D/E workstreams): tile shuffle/position
  updates (`shuffle()`), word-ball duplicate drops, status-ball triggers, timer text
  updates. Their *element* timing anchors are catalogued above where a timeline
  exists.
- Playback durations above are timeline durations at 36 fps; wall-clock behavior
  (e.g. the 200 s timer decrement, docs/02 O01) is out of scope for this catalog.

## 6. docs/08 proposal (O07)

```
RESOLVED 2026-09-28 — evidence/A3-timing.md — FPS = 36 (header); all 24 animation sequences catalogued in data/animation.json with numeric SWF frame spans and frames ÷ 36 durations (4 main-timeline states, 3 element-motion paths with 214/86/19 Move tags, 17 sprite timelines); keyframe offsets defined for capture per docs/07 §4.
```

## 7. SHA-256

| Artifact | SHA-256 |
|---|---|
| `data/animation.json` | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |
| `data/layout.json` | `eb8a098cab21df360cf24dea2f38c2b6b2e56cd16c248b4d6447ce51d3cb292d` |
| `artifacts/decompiled/header.txt` | `23d6a2afca68b837a353c412857cc57ac56a32aaf41285b1b174e5b072aae521` |
| `artifacts/decompiled/tags.xml` | `c5290f02ea0d8bedec255fa64c476877f41adf09bbf92aa565e90f2bb5523765` |

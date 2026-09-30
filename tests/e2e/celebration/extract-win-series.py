#!/usr/bin/env python3
"""Task Y10 — extract the win-timeline series from artifacts/decompiled/tags.xml.

Sources (read-only):
  - main timeline PlaceObject2 tracks for SWF frames 132-241:
      depth 5  = intro_sky     (ch 5,  alpha / fade 188-222)
      depth 9  = intro_layer3  (ch 8,  alpha / fade 188-222)
      depth 7  = intro_glow    (ch 20, ty path 133-222 + tint mult)
      depth 47 = intro_logo    (ch 29, tx/ty/scale 131-202)
      depth 51 = hiscore_form  (ch 166, ty/alpha 222-241)
      depth 49 = bottom_marquee (ch 170, placement frame 241)
  - sprite 169 (`havai` firework): per-frame matrix of the nested ch 168
    spark (scaleX/rotateSkew/translateX in twips) + per-frame alpha
  - sprite 168 (spark): per-frame stroke colour from the ch 167 instance
    colour transform (redOffset/greenOffset/blueOffset; redMultiplier=0 etc.)

Cross-check: every main-timeline value extracted here for the frames also
present in evidence/logs/Y8-main-tracks.json (depth 7/47) must match that
committed extraction byte-for-value; a mismatch aborts (no silent drift).

Output: evidence/logs/Y10-win-series.json
Usage:  python3 tests/e2e/celebration/extract-win-series.py
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TAGS = ROOT / "artifacts/decompiled/tags.xml"
Y8_TRACKS = ROOT / "evidence/logs/Y8-main-tracks.json"
OUT = ROOT / "evidence/logs/Y10-win-series.json"

# Twips per stage pixel (A3: SWF twips; 20 twips = 1 px).
TW = 20.0


def twips(value):
    return int(value) / TW


def main():
    tree = ET.parse(TAGS)
    root = tree.getroot()
    tags = root.find("tags")

    # --- sprite definitions, indexed by spriteId -----------------------------
    sprites = {}
    for item in tags:
        if item.get("type") != "DefineSpriteTag":
            continue
        sprites[int(item.get("spriteId"))] = item.find("subTags")

    def sprite_frames(sprite_id):
        """[{frame, chid, matrix, color}] — frame 1-based, per-depth merge."""
        frames = []
        state = {}  # depth -> {chid, matrix, color}
        frame = 0
        pending = {}
        for tag in sprites[sprite_id]:
            kind = tag.get("type")
            if kind == "ShowFrameTag":
                for depth, s in state.items():
                    pending.setdefault(depth, dict(s))
                frames.append(
                    {
                        "frame": frame + 1,
                        "chid": pending.get(1, {}).get("chid"),
                        "matrix": pending.get(1, {}).get("matrix"),
                        "color": pending.get(1, {}).get("color"),
                    }
                )
                pending = {}
                frame += 1
                continue
            if kind != "PlaceObject2Tag":
                continue
            depth = int(tag.get("depth"))
            target = state.setdefault(depth, {})
            if tag.get("placeFlagHasCharacter") == "true":
                target["chid"] = int(tag.get("characterId"))
            if tag.get("placeFlagHasMatrix") == "true":
                matrix = tag.find("matrix")
                target["matrix"] = matrix.attrib if matrix is not None else {}
            if tag.get("placeFlagHasColorTransform") == "true":
                color = tag.find("colorTransform")
                target["color"] = color.attrib if color is not None else {}
        return frames

    # --- main timeline tracks -------------------------------------------------
    main_frames = []  # 1-based SWF frame -> list of placement dicts
    current = None
    frame = 0
    labels = {}
    for item in tags:
        kind = item.get("type")
        if kind == "ShowFrameTag":
            main_frames.append(current)
            current = None
            frame += 1
            continue
        if kind == "FrameLabelTag":
            # A label precedes the frame it names: SWF frame = next ShowFrame.
            labels[frame + 1] = item.get("name")
            continue
        if kind != "PlaceObject2Tag":
            continue
        entry = {"depth": int(item.get("depth")), "move": item.get("placeFlagMove") == "true"}
        if item.get("placeFlagHasCharacter") == "true":
            entry["chid"] = int(item.get("characterId"))
        if item.get("placeFlagHasMatrix") == "true":
            matrix = item.find("matrix")
            entry["matrix"] = matrix.attrib if matrix is not None else {}
        if item.get("placeFlagHasColorTransform") == "true":
            color = item.find("colorTransform")
            entry["color"] = color.attrib if color is not None else {}
        if current is None:
            current = []
        current.append(entry)

    assert labels.get(132) == "bravo", f"bravo label expected at SWF 132, got {labels.get(132)!r}"
    assert labels.get(5) == "main" and labels.get(131) == "hepsiburda", labels

    def track(depth, lo, hi):
        out = []
        for f in range(lo, hi + 1):
            for entry in main_frames[f - 1] or []:
                if entry["depth"] != depth:
                    continue
                out.append({"frame": f, **entry})
        return out

    def merge(track_entries, lo, hi):
        """Frame -> effective state after applying placements/moves in order."""
        state = None
        merged = {}
        for f in range(lo, hi + 1):
            for entry in track_entries:
                if entry["frame"] != f:
                    continue
                if entry.get("chid") is not None:
                    state = {"frame": f, "chid": entry["chid"]}
                if "matrix" in entry:
                    state = {**(state or {"frame": f}), "frame": f, "matrix": entry["matrix"]}
                if "color" in entry:
                    state = {**(state or {"frame": f}), "frame": f, "color": entry["color"]}
            merged[f] = state
        return merged

    sky = merge(track(5, 132, 241), 132, 241)
    layer3 = merge(track(9, 132, 241), 132, 241)
    glow = merge(track(7, 132, 241), 132, 241)
    logo = merge(track(47, 131, 202), 131, 202)
    form = merge(track(51, 222, 241), 222, 241)
    marquee = merge(track(49, 241, 241), 241, 241)

    # --- cross-check against the committed Y8 extraction (depth 7/47) --------
    y8 = json.loads(Y8_TRACKS.read_text())

    def y8_frames_for(depth):
        out = {}
        for e in y8["depths"][str(depth)]:
            out.setdefault(e["frame"], []).append(e)
        return out

    for depth, merged in ((7, glow), (47, logo)):
        by_frame = y8_frames_for(depth)
        for f, state in merged.items():
            entries = by_frame.get(f, [])
            last = entries[-1] if entries else None
            if last is None:
                continue
            if "matrix" in last:
                expected_ty = twips(last["matrix"]["translateY"])
                got = twips(state["matrix"]["translateY"])
                assert abs(got - expected_ty) < 0.005, (depth, f, got, expected_ty)
            if last.get("color") and int(last["color"].get("redMultTerm", 256)) != 256:
                got_mult = int(state["color"]["redMultTerm"])
                assert got_mult == int(last["color"]["redMultTerm"]), (depth, f, got_mult)
    # Label agreement (Y8 series used SWF 1-based labels too).
    assert [labels[5], labels[130], labels[131], labels[132]] == [
        "main",
        "preall",
        "hepsiburda",
        "bravo",
    ]

    def alpha_series(merged, lo, hi):
        """Effective alphaMultTerm per frame; a placement/move without a colour
        transform keeps the SWF default (opaque, 256)."""
        out = {}
        last_alpha = 256
        for f in range(lo, hi + 1):
            state = merged[f]
            if state is not None and state.get("color") and "alphaMultTerm" in state["color"]:
                last_alpha = int(state["color"]["alphaMultTerm"])
            out[str(f)] = last_alpha
        return out

    def glow_series(merged):
        out = {}
        for f in range(133, 222 + 1):  # per-frame moves 133-222 (place at 129/132)
            state = merged[f]
            assert state is not None and "matrix" in state, f
            record = {"ty": twips(state["matrix"]["translateY"])}
            if state.get("color"):
                record["mult"] = int(state["color"]["redMultTerm"])
                record["add"] = [
                    int(state["color"].get("redAddTerm", 0)),
                    int(state["color"].get("greenAddTerm", 0)),
                    int(state["color"].get("blueAddTerm", 0)),
                ]
            out[str(f)] = record
        return out

    def logo_series(merged):
        out = {}
        for f in range(131, 202 + 1):
            state = merged[f]
            assert state is not None and "matrix" in state, f
            m = state["matrix"]
            out[str(f)] = {
                "tx": twips(m["translateX"]),
                "ty": twips(m["translateY"]),
                "s": float(m.get("scaleX", 1.0)),
            }
        return out

    def form_series(merged):
        out = {}
        for f in range(222, 241 + 1):
            state = merged[f]
            assert state is not None and "matrix" in state, f
            record = {"ty": twips(state["matrix"]["translateY"])}
            if state.get("color") and "alphaMultTerm" in state["color"]:
                record["alpha"] = int(state["color"]["alphaMultTerm"])
            out[str(f)] = record
        return out

    # --- spark (sprite 169 -> nested 168) ------------------------------------
    spark_instances = [e for e in sprite_frames(169) if e and e.get("chid") == 168]
    spark = []
    for e in spark_instances:
        m = e["matrix"]
        spark.append(
            {
                "frame": e["frame"],
                "scaleX": float(m.get("scaleX", 1.0)),
                "scaleY": float(m.get("scaleY", 1.0)),
                "rotateSkew0": float(m.get("rotateSkew0", 0.0)),
                "rotateSkew1": float(m.get("rotateSkew1", 0.0)),
                "tx": twips(m.get("translateX", 0)),
                "ty": twips(m.get("translateY", 0)),
                "alpha": int(e["color"]["alphaMultTerm"]) if e.get("color") else 256,
            }
        )
    assert [s["frame"] for s in spark] == list(range(2, 61)), [s["frame"] for s in spark]

    spark_colors = []
    for e in sprite_frames(168):
        if e is None or e.get("chid") != 167:
            continue
        c = e["color"]
        # colour' = mult*0 + add   (Symbol 168: redMultiplier=0 green=0 blue=0;
        # tags.xml stores the add terms as redAddTerm/greenAddTerm/blueAddTerm)
        spark_colors.append(
            {
                "frame": e["frame"],
                "rgb": [
                    int(c.get("redAddTerm", 0)),
                    int(c.get("greenAddTerm", 0)),
                    int(c.get("blueAddTerm", 0)),
                ],
            }
        )
    assert [c["frame"] for c in spark_colors] == list(range(1, 61)), [c["frame"] for c in spark_colors]

    data = {
        "source": "artifacts/decompiled/tags.xml (main-timeline PlaceObject2 tracks frames 132-241; DefineSpriteTag 168/169/170)",
        "fps": 36,
        "win": {
            "frameStart": 132,
            "frameEnd": 241,
            "skyAlpha": alpha_series(sky, 132, 241),
            "layer3Alpha": alpha_series(layer3, 132, 241),
            "glow": glow_series(glow),
            "logo": logo_series(logo),
            "form": form_series(form),
            "marquee": {
                "placementFrame": 241,
                "tx": twips(marquee[241]["matrix"]["translateX"]),
                "ty": twips(marquee[241]["matrix"]["translateY"]),
            },
        },
        "havai": {  # sprite 169 name (firework)
            "spriteFrames": 60,
            "templateFrame": 1,
            "instance": spark,
            "sparkColors": spark_colors,
        },
        "sprite170": {
            "frameCount": 65,
            "duplicateCount": 300,
            "removeFrame": 65,
            "sparkTemplateRemovedAtSpriteFrame": 2,
        },
    }
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"glow frames {len(data['win']['glow'])}, logo {len(data['win']['logo'])}, form {len(data['win']['form'])}, spark {len(spark)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

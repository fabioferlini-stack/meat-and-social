#!/usr/bin/env python3
"""Turn data/curation.json + data/menu.json + raw/ pulls into site/media/** and site/data.js.

Reels keep Instagram's full 1080x1920 quality (the DASH track, see fetch_instagram.py):
  media/reels/<code>.mp4          full reel with sound, H.264 1080p (loaded only on click)
  media/reels/<code>-teaser.mp4   silent loop for autoplay tiles, 720 wide
  media/reels/<code>.webp         poster frame
Images: media/img/<key>-{640,1280,1920}.webp (never upscaled).
"""
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None  # the photographer's originals run to ~90MP

ROOT = Path(__file__).resolve().parent.parent
RAW, SITE = ROOT / "raw", ROOT / "site"
# Photographer's originals: curation paths starting "photography/" resolve here (set PHOTOS_DIR to the
# folder holding the shoot folders). Without them, existing renditions in site/media/img are reused.
PHOTOS = Path(os.environ.get("PHOTOS_DIR", ROOT / "raw" / "photography"))
MEDIA = SITE / "media"


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *map(str, args)], check=True)


def src_path(src):
    if src.startswith("photography/"):
        return PHOTOS / src[len("photography/"):]
    return RAW / "img" / src


def image(key, src, focal=None):
    targets = (640, 1280, 1920, 2560)
    dests = {t: MEDIA / "img" / f"{key}-{t}.webp" for t in targets}
    path = src_path(src)
    if all(d.exists() for d in dests.values()) and not path.exists():
        # originals not on this machine: describe the committed renditions instead of re-rendering
        sizes = {t: Image.open(d).size for t, d in dests.items()}
        w, h = sizes[2560]
        out = {"w": w, "h": h, "focal": focal or [50, 50], "widths": [sizes[t][0] for t in targets]}
        for t in targets:
            out[f"src{t}"] = f"media/img/{key}-{t}.webp"
        return out
    im = Image.open(path)
    im.draft("RGB", (3840, 3840))
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    out = {"w": w, "h": h, "focal": focal or [50, 50]}
    for target in targets:
        dest = dests[target]
        tw = min(target, w)
        if not dest.exists():
            r = im if tw == w else im.resize((tw, round(h * tw / w)), Image.LANCZOS)
            r.save(dest, "WEBP", quality=78 if target == 640 else 80 if target < 2560 else 76, method=6)
        out[f"src{target}"] = f"media/img/{key}-{target}.webp"
        out.setdefault("widths", []).append(tw)
    return out

def reel(r, post):
    code = r["code"]
    src = RAW / "vid" / f"{code}.mp4"
    out = MEDIA / "reels"
    full, teaser, poster = out / f"{code}.mp4", out / f"{code}-teaser.mp4", out / f"{code}.webp"
    if not full.exists():
        ffmpeg("-i", src, "-vf", "scale='min(1080,iw)':-2", "-c:v", "libx264", "-preset", "slow", "-crf", 23,
               "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
               "-c:a", "aac", "-b:a", "128k", full)
    if not teaser.exists():
        ffmpeg("-ss", r.get("start", 0), "-t", r.get("len", 7), "-i", src, "-an",
               "-vf", "scale='min(720,iw)':-2,fps=30", "-c:v", "libx264", "-preset", "slow", "-crf", 27,
               "-pix_fmt", "yuv420p", "-movflags", "+faststart", teaser)
    if not poster.exists():
        tmp = out / f"_{code}.png"
        ffmpeg("-ss", r.get("poster", r.get("start", 0)), "-i", src, "-frames:v", 1, "-vf", "scale=720:-2", tmp)
        Image.open(tmp).convert("RGB").save(poster, "WEBP", quality=80, method=6)
        tmp.unlink()
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                                "csv=p=0", str(full)], capture_output=True, text=True).stdout)
    owner = post.get("owner") or "meatandsocial"
    return {
        "code": code, "title": r["title"], "blurb": r.get("blurb", ""), "tag": r.get("tag", ""), "cat": r.get("cat", ""),
        "url": f"https://www.instagram.com/reel/{code}/", "by": owner,
        "src": f"media/reels/{code}.mp4", "teaser": f"media/reels/{code}-teaser.mp4",
        "poster": f"media/reels/{code}.webp", "duration": round(dur, 1),
        "likes": post.get("likes"), "date": date(post),
    }


def date(post):
    t = post.get("taken_at")
    return datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d") if t else None


def main():
    for d in ("img", "reels"):
        (MEDIA / d).mkdir(parents=True, exist_ok=True)
    cur = json.loads((ROOT / "data/curation.json").read_text())
    menu = json.loads((ROOT / "data/menu.json").read_text())
    posts = json.loads((ROOT / "data/posts_raw.json").read_text())
    images = {}
    for key, spec in cur["images"].items():
        images[key] = image(key, spec["src"], spec.get("focal"))
        images[key]["alt"] = spec["alt"]
        if spec.get("cat"):
            images[key]["cat"] = spec["cat"]
        if spec.get("code"):
            images[key]["url"] = f"https://www.instagram.com/p/{spec['code']}/"
    reels = [reel(r, posts.get(r["code"], {})) for r in cur["reels"]]
    # OG image: 1200x630 crop of the chosen photo
    og_path = src_path(cur["images"][cur["og"]]["src"])
    if og_path.exists():
        og = ImageOps.exif_transpose(Image.open(og_path)).convert("RGB")
        ImageOps.fit(og, (1200, 630), Image.LANCZOS, centering=(0.5, 0.55)).save(MEDIA / "og.jpg", quality=84)
    data = {
        "profile": cur["profile"], "images": images, "reels": reels,
        "hero_image": cur.get("hero_image"), "gallery": cur["gallery"], "gallery_cats": cur.get("gallery_cats", []), "hero": cur["hero"],
        "reel_cats": cur.get("reel_cats", []), "press": cur.get("press", []),
        "reviews": json.loads((ROOT / "data/reviews.json").read_text()),
        "menu": menu,
    }
    js = ("/* Generated by scripts/process_media.py from data/curation.json + data/menu.json. "
          "Do not edit by hand. */\nwindow.MS = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n")
    (SITE / "data.js").write_text(js)
    print(f"{len(images)} images, {len(reels)} reels -> site/data.js")


if __name__ == "__main__":
    main()

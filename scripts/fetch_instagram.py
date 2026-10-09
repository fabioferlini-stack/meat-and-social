#!/usr/bin/env python3
"""Pull post metadata + media for the shortlisted Instagram posts.

Reads data/candidates.txt (lines: "<P|N|V> code code ..."), fetches each post's
public page, pulls the embedded JSON for that post, and downloads:
  raw/img/<code>.jpg        cover image (largest rendition)
  raw/img/<code>_<n>.jpg    every carousel slide (n from 1)
  raw/vid/<code>.mp4        the video at its best quality: the 1080p DASH video track
                            muxed with its audio track (the progressive "video_versions"
                            files Instagram also serves top out at 720p)
Metadata for every post lands in data/posts_raw.json.

The CDN links Instagram hands out are signed and expire after a few days,
so re-run this rather than hot-linking anything.
"""
import json
import subprocess
import xml.etree.ElementTree as ET
import random
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-GB,en;q=0.9",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Dest": "document",
}
SCRIPT_RE = re.compile(r'<script type="application/json"[^>]*>(.*?)</script>', re.S)


def get(url, binary=False, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                return data if binary else data.decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001 - log and back off
            wait = 20 * (attempt + 1)
            print(f"  ! {e} -> retry in {wait}s", flush=True)
            time.sleep(wait)
    return None


def find_node(obj, code, depth=0):
    if depth > 80:
        return None
    if isinstance(obj, dict):
        if obj.get("code") == code and ("image_versions2" in obj or "carousel_media" in obj):
            return obj
        for v in obj.values():
            hit = find_node(v, code, depth + 1)
            if hit:
                return hit
    elif isinstance(obj, list):
        for v in obj:
            hit = find_node(v, code, depth + 1)
            if hit:
                return hit
    return None


def best_image(node):
    cands = (node.get("image_versions2") or {}).get("candidates") or []
    return max(cands, key=lambda c: c.get("width", 0))["url"] if cands else None


def best_video(node):
    vv = node.get("video_versions") or []
    return max(vv, key=lambda v: v.get("width", 0))["url"] if vv else None


def best_dash(node):
    """(video_url, audio_url, height) for the tallest DASH video track, or None."""
    mpd = node.get("video_dash_manifest")
    if not mpd:
        return None
    ns = {"m": "urn:mpeg:dash:schema:mpd:2011"}
    try:
        root = ET.fromstring(mpd)
    except ET.ParseError:
        return None
    video, audio = [], []
    for rep in root.iter("{urn:mpeg:dash:schema:mpd:2011}Representation"):
        base = rep.find("m:BaseURL", ns)
        if base is None or not base.text:
            continue
        if rep.get("mimeType", "").startswith("video"):
            video.append((int(rep.get("height") or 0), int(rep.get("bandwidth") or 0), base.text))
        elif rep.get("mimeType", "").startswith("audio"):
            audio.append((int(rep.get("bandwidth") or 0), base.text))
    if not video:
        return None
    h, _, vurl = max(video)
    return vurl, (max(audio)[1] if audio else None), h


def download_video(node, dest):
    """Mux the best DASH tracks into dest; fall back to the best progressive file."""
    dash = best_dash(node)
    if dash:
        vurl, aurl, h = dash
        tmp_v, tmp_a = dest.with_suffix(".v.mp4"), dest.with_suffix(".a.mp4")
        v = get(vurl, binary=True)
        a = get(aurl, binary=True) if aurl else None
        if v:
            tmp_v.write_bytes(v)
            cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp_v)]
            if a:
                tmp_a.write_bytes(a)
                cmd += ["-i", str(tmp_a), "-map", "0:v:0", "-map", "1:a:0"]
            cmd += ["-c", "copy", "-movflags", "+faststart", str(dest)]
            ok = subprocess.run(cmd).returncode == 0
            tmp_v.unlink(missing_ok=True)
            tmp_a.unlink(missing_ok=True)
            if ok:
                return f"dash {h}p"
    url = best_video(node)
    data = get(url, binary=True) if url else None
    if data:
        dest.write_bytes(data)
        return "progressive"
    return None


def parse(html, code):
    for block in SCRIPT_RE.findall(html):
        if code not in block:
            continue
        try:
            hit = find_node(json.loads(block), code)
        except json.JSONDecodeError:
            continue
        if hit:
            return hit
    return None


def main():
    # --meta: metadata only (rank first, then re-run with codes to download their media)
    meta_only = "--meta" in sys.argv
    only = {a for a in sys.argv[1:] if not a.startswith("--")}
    groups = []
    for line in (ROOT / "data/candidates.txt").read_text().splitlines():
        if line.strip() and not line.startswith("#"):
            kind, *codes = line.split()
            groups += [(kind, c) for c in codes]
    out_path = ROOT / "data/posts_raw.json"
    posts = json.loads(out_path.read_text()) if out_path.exists() else {}
    (RAW / "img").mkdir(parents=True, exist_ok=True)
    (RAW / "vid").mkdir(parents=True, exist_ok=True)

    for i, (kind, code) in enumerate(groups, 1):
        if only and code not in only:
            continue
        if code in posts and posts[code].get("ok") and (not only or meta_only):
            continue
        print(f"[{i}/{len(groups)}] {kind} {code}", flush=True)
        html = get(f"https://www.instagram.com/p/{code}/")
        node = parse(html, code) if html else None
        if not node:
            print("  ! no data", flush=True)
            posts[code] = {"code": code, "kind": kind, "ok": False}
            time.sleep(8)
            continue
        slides = []
        for j, child in enumerate(node.get("carousel_media") or [], 1):
            slides.append({"n": j, "media_type": child.get("media_type"),
                           "w": child.get("original_width"), "h": child.get("original_height"),
                           "img": best_image(child), "video": best_video(child)})
        cap = (node.get("caption") or {}).get("text") or ""
        rec = {
            "code": code, "kind": kind, "ok": True,
            "taken_at": node.get("taken_at"),
            "likes": node.get("like_count"), "comments": node.get("comment_count"),
            "media_type": node.get("media_type"), "product_type": node.get("product_type"),
            "w": node.get("original_width"), "h": node.get("original_height"),
            "duration": node.get("video_duration"),
            "plays": node.get("play_count") or node.get("ig_play_count") or node.get("view_count"),
            "owner": (node.get("user") or {}).get("username"),
            "caption": cap, "alt": node.get("accessibility_caption"),
            "img": best_image(node) or (slides[0]["img"] if slides else None),
            "video": best_video(node),
            "slides": slides,
        }
        posts[code] = rec
        if meta_only:
            out_path.write_text(json.dumps(posts, indent=1, ensure_ascii=False))
            time.sleep(random.uniform(1.5, 3.0))
            continue
        # cover
        dest = RAW / "img" / f"{code}.jpg"
        if rec["img"] and not dest.exists():
            data = get(rec["img"], binary=True)
            if data:
                dest.write_bytes(data)
        for s in slides:
            d = RAW / "img" / f"{code}_{s['n']}.jpg"
            if s["img"] and not d.exists():
                data = get(s["img"], binary=True)
                if data:
                    d.write_bytes(data)
        if rec["video"] or node.get("video_dash_manifest"):
            d = RAW / "vid" / f"{code}.mp4"
            if not d.exists():
                rec["video_source"] = download_video(node, d)
                print(f"  video: {rec['video_source']}", flush=True)
        for s in slides:
            child = (node.get("carousel_media") or [])[s["n"] - 1]
            d = RAW / "vid" / f"{code}_{s['n']}.mp4"
            if s["video"] and not d.exists():
                s["video_source"] = download_video(child, d)
        posts[code] = rec
        out_path.write_text(json.dumps(posts, indent=1, ensure_ascii=False))
        time.sleep(random.uniform(1.5, 3.0))

    out_path.write_text(json.dumps(posts, indent=1, ensure_ascii=False))
    ok = sum(1 for p in posts.values() if p.get("ok"))
    print(f"done: {ok}/{len(posts)} ok", flush=True)


if __name__ == "__main__":
    main()

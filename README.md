# Meat & Social

Website for [Meat & Social](https://www.meatandsocial.co.uk/), restaurant and in-house butcher on Olympic Way, Wembley Park.

A static site: plain HTML, CSS and JavaScript, with no build step and no database. Everything the site shows (menus, Sunday roast, reels, photos, reviews) lives in the files in `site/`, and it can be hosted anywhere that serves static files.

## Go-live checklist
1. **Point the domain** (meatandsocial.co.uk) at the new host. The site is set to be indexed by search engines.
2. **Analytics** (Google Tag Manager `GTM-W8H2LJHR`, with GA4 and the Meta Pixel inside) switches on automatically on meatandsocial.co.uk, behind the cookie banner. On any other address it stays off. To test elsewhere, add `?analytics=1` to the URL.
3. **Check the details**: Sunday roast serving times, and that the postcode (HA9 0GU) matches the Google Business Profile.

## Hosting on Netlify
Import this repository in Netlify ("Add new site" → "Import an existing project"). `netlify.toml` already sets the publish folder to `site`, so there is nothing to configure. Every push to `main` deploys automatically.

On any other host, upload the contents of the `site/` folder.

## Project layout
- `site/`: the website itself. This is the only folder that gets published.
  - `index.html`, `styles.css`, `app.js`: the page.
  - `data.js`: all the content (menus, reels, photos, reviews). It is generated from `data/`; see "Updating content".
  - `analytics.js`: Google Tag Manager, Meta Pixel and the cookie banner.
  - `media/`: photos (WebP at 640/1280/1920/2560 px), reels (1080p with sound, plus short silent loops) and poster frames.
- `data/`: the source content.
  - `menu.json`: food, Social Board, drinks, lunch deal and Sunday roast.
  - `curation.json`: contact details, opening hours, hero, reels and photos, and which photo goes with which dish.
  - `reviews.json`: selected 4 and 5-star Google review excerpts.
- `scripts/`: tools to rebuild `site/data.js` and the media.

## Updating content
**Quick text or price change:** edit `site/data.js` directly. It is plain JSON-style data. The next rebuild (below) will overwrite it, so make the same change in `data/` too.

**Proper update:** edit the files in `data/`, then rebuild:
```bash
python3 -m venv .venv && .venv/bin/pip install Pillow     # once
.venv/bin/python scripts/process_media.py                 # needs ffmpeg installed for reels
```
The photographer's original images are not in this repository. Their WebP versions are. To add or re-crop photos from the shoot, set `PHOTOS_DIR` to the folder holding the shoot folders (it uses the paths in `curation.json` that start `photography/`). Without it, the existing images are reused.

**New Instagram reels:** add post codes to `data/candidates.txt`, run `python3 scripts/fetch_instagram.py CODE ...`, add them to `reels` in `data/curation.json`, then rebuild. Downloads use Instagram's full-quality 1080p stream. Instagram's media links expire, so media is always downloaded and hosted with the site rather than linked.

## Google reviews
The selected reviews in `data/reviews.json` are built into the page, so the section needs no setup, API key or account.

**Optional auto-update (free, no API key):** create a free widget for Meat & Social at [featurable.com](https://featurable.com), put its widget ID in `profile.google.featurableId` in `data/curation.json` (or in `site/data.js`), and rebuild. The page then reads Featurable's public feed in the visitor's browser and updates the rating and review count. New 4 and 5-star reviews appear above the selected ones. The widget ID is public, not a secret. If it is blank or the feed is unavailable, the selected reviews show as normal.

## Booking
All "Book" buttons link to the Toast reservations page. The booking link and contact details are in `profile` in `data/curation.json`.

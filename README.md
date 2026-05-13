# SnackTape

SnackTape is a Chrome MV3 side-panel extension for turning favorite YouTube moments into local video mixtapes.

It is built around a simple loop: mark an IN point, mark an OUT point, save the range to a mixtape, then replay saved clips as a queue. The current app focuses on a compact side-panel workflow with three tabs: `Edit / Mixtapes / Settings`.

## What It Does

- Saves YouTube time ranges as reusable clips.
- Groups clips into mixtapes stored locally in the browser.
- Plays mixtapes through a Now Playing view with queue controls.
- Lets users edit saved ranges, reorder queues, rename mixtapes, delete clips, and delete mixtapes.
- Supports accent themes and Korean/English/Japanese app language selection.

## Scope

SnackTape is intentionally local-first and YouTube-focused. It does not download, reupload, scrape, or bypass access controls for videos. It only controls playback position for videos the user can already view in the browser.

This repository targets the Chrome side panel experience defined in `manifest.json`.

## Developer Mode

1. Install dependencies with `npm install`.
2. Build the unpacked extension with `npm run build`.
3. Open `chrome://extensions` in Chrome and enable `Developer mode`.
4. Click `Load unpacked` and select the generated `dist/` directory.
5. After source changes, run `npm run build` again and click `Reload` on the extension card.

## GitHub Release Install

SnackTape is distributed through GitHub Releases, not the Chrome Web Store.

1. Download the latest `snacktape-v*.zip` asset from the Releases page.
2. Unzip it into a stable local folder, such as `~/Applications/SnackTape`.
3. Open `chrome://extensions` in Chrome and enable `Developer mode`.
4. Click `Load unpacked` and select the unzipped folder that contains `manifest.json`.
5. To upgrade, replace the files in the same folder and click `Reload` on the extension card.

Keeping the same folder path helps Chrome keep the unpacked extension identity stable between releases.

## Release Build

For maintainers, `npm run release:zip` builds the extension, runs the dist smoke check, and writes a GitHub Release zip asset to `release/snacktape-v*.zip`.

Upload that zip file to a GitHub Release. The archive is structured so `manifest.json` is at the root after extraction. The zip script uses Node APIs only, so it does not require a system `zip` command.

## License

MIT

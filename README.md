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

## License

MIT

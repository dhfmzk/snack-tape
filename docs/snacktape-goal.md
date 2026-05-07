# SnackTape Goal

## Work Goal

This repository implements the Manifest V3 Chrome Extension MVP `SnackTape`.

The product goal is a local extension that lets users play only selected time ranges from multiple YouTube videos in sequence.

The product concept is: a personal video mixtape made from favorite moments.

## Actual Reference Boundary

1. The user's handoff and feedback are the top-level implementation source of truth.
2. Clip Playlist is treated only as a public reference for feature scope, UX scope, technology choices, and extension structure.
3. SnackTape must not copy or borrow code, UI assets, data files, or implementation details from Clip Playlist or any other extension.

## Public Reference Notes from Clip Playlist

- It is a real Chrome Web Store product that handles start/end-time clip playlist playback.
- Its public listing mentions support for YouTube, Google Drive, and TwitCasting.
- Its public repository uses TypeScript, Webpack 5, Bootstrap, and SCSS.
- It uses a Manifest V3 background service worker, popup, and content script structure.
- It has broader scope than the SnackTape MVP, including built-in playlists, random playback, tag filters, URL-parameter playback, captions, and lyrics.

## Intentional SnackTape Differences

- Keep the MVP focused on YouTube.
- Support Korean, English, and Japanese app UI through an in-app language setting.
- Capture start/end points quickly from the current YouTube page.
- Provide segment-card editing, ordering, and JSON import/export surfaces.
- Use local storage only. Do not implement accounts, cloud sync, share links, captions, or tag systems.

## Implementation Scope

- Create Chrome-loadable unpacked extension output in `dist/`.
- Side Panel UI: Edit, Mixtapes, Settings, and Playback screens.
- Edit tab: current YouTube video information, save target selection, IN/OUT capture, segment add, range adjustment/deletion, and mixtape deletion.
- Mixtapes tab: sequence creation/selection, empty-tape routing to Edit, and filled-tape routing to Playback.
- Content script: YouTube video element control, SPA navigation handling, and a minimal autoplay-failure overlay.
- Storage: `chrome.storage.local`, `chrome.storage.session` first for playback state, and local fallback.
- README: install, build, Chrome load-unpacked flow, manual QA, limits, and safety principles.

## Safety Principles

- Do not bypass YouTube ads, DRM, login walls, region restrictions, age restrictions, or private access controls.
- Do not download or reupload videos. Do not scrape private content.
- Only control playback position and playback flow for videos the user can already view in the browser.
- When autoplay fails, provide only a minimal resume button overlay.

## Completion Criteria

- `npx --yes --package typescript@5.9.3 tsc -p tsconfig.test.json` and `node --test tests/*.test.mjs` pass.
- `npx --yes --package typescript@5.9.3 tsc --noEmit -p tsconfig.json` and `node scripts/build.mjs` pass.
- `dist/manifest.json` and every file referenced by the manifest exist.
- The side panel Edit tab can capture YouTube ranges and add segments.
- The side panel can manage sequences and segments.
- Playback can play same-video and cross-video segments in order and clear state after the final segment.
- UI/UX and behavior feedback are reviewed and reflected where needed.

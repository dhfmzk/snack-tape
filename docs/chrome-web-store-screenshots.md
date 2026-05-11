# Chrome Web Store Screenshot Plan

This plan tracks the screenshots to capture once the side panel UI is stable enough for the first Chrome Web Store listing.

## Current Store Requirements

Official Chrome Web Store guidance says the listing needs at least one screenshot, and preferably the maximum of five. Screenshots should show the real extension experience, use square corners with no padding, and be exported at either `1280x800` or `640x400`.

Sources:

- https://developer.chrome.com/webstore/images#screenshots
- https://developer.chrome.com/docs/webstore/best_listing#screenshots

## Capture Setup

- Build the current extension with `npm run build`.
- Load `dist/` through Chrome developer mode.
- Use a real YouTube watch page with safe, non-sensitive demo content.
- Use the default English locale for the primary listing screenshots.
- Capture at `1280x800` when possible so the store can downscale cleanly.
- Keep screenshots full bleed: no browser chrome, padding, mock device frame, or decorative caption layer.
- Avoid private watch history, real account details, and creator names that would imply endorsement.

## Required Screenshot Set

| # | Screen | Purpose | Required state |
| --- | --- | --- | --- |
| 1 | Edit | Show the core clip capture workflow. | A YouTube watch page is detected, a save target is selected, and IN/OUT capture controls are visible with several saved clips below. |
| 2 | Mixtapes | Show saved mixtape management. | At least three mixtapes exist, with visible thumbnails, durations, clip counts, search, sort, and the floating new-tape action. |
| 3 | Playback | Show now-playing and queue controls. | A mixtape is actively playing, progress is synced, and the full queue is visible without dimmed or removed rows. |
| 4 | Queue Edit | Show playback order editing. | Queue edit mode is open with reorder, remove, save, and cancel controls visible. |
| 5 | Settings | Show personalization and local data controls. | Language, accent color, playback, capture, import/export, reset, and local-only data controls are visible. |

## Acceptance Checklist

- Every screenshot uses the same accent theme and language.
- Text is readable after downscaling to `640x400`.
- The screenshot set explains capture, organize, play, adjust queue, and configure flows without extra marketing copy.
- No screenshot exposes personal account data, cookies, recommendations, or private local files.
- The visuals match the committed UI in `dist/` for the release version being submitted.

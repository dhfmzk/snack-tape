# SnackTape Current Backlog

Date: 2026-05-11

Scope: current open work only. Completed bug fixes and finished feature work have been removed from this file so the next implementation pass can focus on what is still useful.

## Status

- Open defects: 0 confirmed open defects.
- Open product and release work: 14 items.
- Severity split: P1 High 0, P2 Medium 7, P3 Low 7.

## Priority Order

1. Improve P2 repeated-use friction: capture precision, localization, and browser-level QA.
2. Defer P3 polish and release packaging until the core flows feel calm in manual use.

## P2 Medium

| ID | Area | Remaining work | Evidence | Next step |
| --- | --- | --- | --- | --- |
| ST-GAP-026 | Capture precision | Draft capture only previews and nudges the IN point. OUT is still captured as "now" without a pre-save preview or adjustment path. | `src/screens/Capture.tsx`, `src/state/store.ts` | Add optional draft OUT preview once IN exists, with frame/second nudges before save. |
| ST-GAP-027 | Capture | There is no explicit "clear current IN" action. Users can only overwrite the draft or finish it with OUT. | `src/screens/Capture.tsx`, `src/state/store.ts`, `src/shared/draft.ts` | Add a clear-draft action and test that storage/session state clears immediately. |
| ST-GAP-044 | Localization | Several background/content/validation/storage errors are still hard-coded Korean or technical English instead of routed through i18n. | `src/background/background.ts`, `src/content/contentScript.ts`, `src/shared/validation.ts`, `src/shared/storage.ts` | Centralize user-visible error keys and keep internal-only errors out of UI. |
| ST-GAP-045 | Accessibility | There is no keyboard-only QA pass for Edit menus, native selects, Settings toggles, and queue editing. | `src/screens/Capture.tsx`, `src/screens/Settings.tsx`, `src/screens/Playback.tsx` | Add keyboard navigation tests and a short manual keyboard checklist. |
| ST-GAP-046 | Browser QA | Tests still use lightweight DOM shims, not a real browser or loaded Chrome extension environment. | `tests/*Screen.test.mjs`, `scripts/check-dist.mjs` | Add Playwright or Chrome load-unpacked smoke coverage for the side panel. |
| ST-GAP-051 | Extension icon | The icon draft was intentionally stashed and the manifest still has no finalized extension icons. | `manifest.json`, `public/icons` | Create a simpler approved icon set and wire `icons` plus action icons into the manifest. |
| ST-GAP-052 | Import safety | JSON import works, but it is still a direct replace flow without preview, conflict summary, merge option, or automatic pre-import backup. | `src/state/store.ts`, `src/shared/dataTransfer.ts`, `src/screens/Settings.tsx` | Add import preview with replace/merge decision and a JSON backup before replace. |

## P3 Low

| ID | Area | Remaining work | Evidence | Next step |
| --- | --- | --- | --- | --- |
| ST-GAP-024 | Edit visual continuity | Saved clip rows in the Edit tab are more text-heavy than Playback queue/Home and do not fully use thumbnail continuity. | `src/screens/Capture.tsx`, `src/components/Thumb.tsx` | Add compact thumbnails only if it does not hurt Edit density. |
| ST-GAP-025 | Capture metadata | Content reads channel metadata, but the Edit tab does not surface it. | `src/content/contentScript.ts`, `src/screens/Capture.tsx` | Either show channel/source metadata or remove unused channel from the app-facing model. |
| ST-GAP-028 | Multi-tab capture | Capture uses the active tab only. There is no explicit selector when several YouTube videos are open. | `src/state/youtube.ts`, `src/state/videoDetection.ts` | Defer unless real use shows multi-tab capture confusion. |
| ST-GAP-040 | Clip notes | `Segment.note` exists and exports to CSV, but there is no note editing UI. | `src/shared/types.ts`, `src/shared/dataTransfer.ts`, `src/screens/Capture.tsx` | Add notes after time editing stabilizes, or remove the field before release. |
| ST-GAP-041 | Organization | There are no tags, categories, or source filters for larger clip libraries. | `src/shared/types.ts`, `src/screens/Home.tsx` | Keep deferred until the user has enough real tapes to justify structure. |
| ST-GAP-050 | Release packaging | There is no zip/CRX packaging script or version/changelog flow. | `package.json`, `.gitignore`, `manifest.json` | Add a release script once the icon and core QA are ready. |
| ST-GAP-053 | Store listing assets | Chrome Web Store listing copy, screenshots, and promotional assets are not tracked in the repo. | `README.md`, `manifest.json`, `public/icons` | Create listing assets after the extension icon direction is approved. |

## Removed From Active Backlog

- All previously tracked `ST-BUG-*` items are considered fixed and are no longer listed here.
- Completed settings, mixtape management, rendering, storage, language, queue-separation, capture status, exact saved-range editing, playback seek/pause/resume, playback queue row actions, playback target readiness, playback error visibility, playback recovery, and closed-panel command coverage work has been removed from the active table.
- Shorts/embed support was removed from the active backlog because the current MVP manifest and parser target YouTube watch pages only.

# SnackTape Current Backlog

Date: 2026-05-12

Scope: current open work only. Completed bug fixes and finished feature work have been removed from this file so the next implementation pass can focus on useful product development, release readiness, and QA hardening.

## Status

- Open defects: 0 confirmed open defects.
- Open product and release work: 53 items.
- Severity split: P1 High 10, P2 Medium 27, P3 Low 17.
- Suggested workload: enough for an overnight implementation pass if split into capture, QA, data safety, release, and polish tracks.

## Overnight Work Order

1. Stabilize capture usability: `ST-GAP-026`, `ST-GAP-027`, `ST-GAP-062`.
2. Harden user-visible failures: `ST-GAP-044`, `ST-GAP-054`, `ST-GAP-056`.
3. Add data-safety guardrails: `ST-GAP-055`, `ST-GAP-059`.
4. Add real extension/browser confidence: `ST-GAP-046`, `ST-GAP-045`, `ST-GAP-079`.
5. Prepare release assets and package flow: `ST-GAP-051`, `ST-GAP-058`, `ST-GAP-053`.
6. Use remaining time for edit-library productivity: `ST-GAP-063` through `ST-GAP-068`.

## P1 High

| ID | Area | Remaining work | Evidence | Next step |
| --- | --- | --- | --- | --- |
| ST-GAP-026 | Capture precision | Draft capture only previews and nudges the IN point. OUT is still captured as "now" without a pre-save preview or adjustment path. | `src/screens/Capture.tsx`, `src/state/store.ts` | Add optional draft OUT preview once IN exists, with frame/second nudges before save. |
| ST-GAP-027 | Capture recovery | There is no explicit "clear current IN" action. Users can only overwrite the draft or finish it with OUT. | `src/screens/Capture.tsx`, `src/state/store.ts`, `src/shared/draft.ts` | Add a clear-draft action and test that storage/session state clears immediately. |
| ST-GAP-044 | Localization | Several background/content/validation/storage errors are still hard-coded Korean or technical English instead of routed through i18n. | `src/background/background.ts`, `src/content/contentScript.ts`, `src/shared/validation.ts`, `src/shared/storage.ts` | Centralize user-visible error keys and keep internal-only errors out of UI. |
| ST-GAP-046 | Browser QA | Tests still use lightweight DOM shims, not a real browser or loaded Chrome extension environment. | `tests/*Screen.test.mjs`, `scripts/check-dist.mjs` | Add Playwright or Chrome load-unpacked smoke coverage for the side panel. |
| ST-GAP-051 | Extension icon | The icon draft was intentionally stashed and the manifest still has no finalized extension icons. | `manifest.json`, `public/icons` | Create a simpler approved icon set and wire `icons` plus action icons into the manifest. |
| ST-GAP-054 | Runtime errors | Runtime message failures are transported as display strings, which makes localization and recovery behavior harder to keep consistent. | `src/background/background.ts`, `src/state/store.ts`, `src/shared/types.ts` | Return stable error codes from background/content and map them to localized UI copy in the store layer. |
| ST-GAP-055 | Storage migrations | Storage normalization repairs current data, but there is no explicit schema version, migration path, or migration test fixture. | `src/shared/storage.ts`, `src/state/storage.ts`, `tests/storage.test.mjs` | Add schema version metadata, migration helpers, and legacy fixture tests. |
| ST-GAP-056 | Playback reconnect UX | Recovery can restart playback, but the UI does not clearly explain whether it will preserve current session queue order, mode, and edited queue state. | `src/screens/Playback.tsx`, `src/state/store.ts` | Show reconnect copy that names the target tape and mode, and preserve edited queue recovery explicitly. |
| ST-GAP-058 | Release package | There is no zip/CRX packaging script or pre-release validation command. | `package.json`, `scripts/`, `dist/`, `manifest.json` | Add a release script that builds, smoke-checks, zips `dist`, and prints the artifact path. |

## P2 Medium

| ID | Area | Remaining work | Evidence | Next step |
| --- | --- | --- | --- | --- |
| ST-GAP-024 | Edit visual continuity | Saved clip rows in the Edit tab are more text-heavy than Playback queue/Home and do not fully use thumbnail continuity. | `src/screens/Capture.tsx`, `src/components/Thumb.tsx` | Add compact thumbnails only if it does not hurt Edit density. |
| ST-GAP-025 | Capture metadata | Content reads channel metadata, but the Edit tab does not surface it. | `src/content/contentScript.ts`, `src/screens/Capture.tsx` | Either show channel/source metadata or remove unused channel from the app-facing model. |
| ST-GAP-028 | Multi-tab capture | Capture uses the active tab only. There is no explicit selector when several YouTube videos are open. | `src/state/youtube.ts`, `src/state/videoDetection.ts` | Add a small YouTube tab selector only when more than one candidate tab is available. |
| ST-GAP-040 | Clip notes | `Segment.note` exists and exports to CSV, but there is no note editing UI. | `src/shared/types.ts`, `src/shared/dataTransfer.ts`, `src/screens/Capture.tsx` | Add notes after time editing stabilizes, or remove the field before release. |
| ST-GAP-041 | Organization | There are no tags, categories, or source filters for larger clip libraries. | `src/shared/types.ts`, `src/screens/Home.tsx` | Add a minimal tag model only after search/filter basics exist. |
| ST-GAP-045 | Accessibility | There is no keyboard-only QA pass for Edit menus, native selects, Settings toggles, and queue editing. | `src/screens/Capture.tsx`, `src/screens/Settings.tsx`, `src/screens/Playback.tsx` | Add keyboard navigation tests and a short manual keyboard checklist. |
| ST-GAP-053 | Store listing assets | Chrome Web Store listing copy, screenshots, and promotional assets are not tracked in the repo. | `README.md`, `manifest.json`, `public/icons` | Create listing copy, screenshot plan, and promotional image checklist after icon direction is approved. |
| ST-GAP-059 | Import duplicates | Import does not explain how duplicate tape names, duplicate clips, or identical source ranges will be handled. | `src/shared/dataTransfer.ts`, `src/state/store.ts` | Add duplicate detection and present counts in import preview before merge/replace. |
| ST-GAP-060 | Settings reset | Users cannot reset settings to defaults without clearing all data. | `src/screens/Settings.tsx`, `src/state/store.ts`, `src/state/storage.ts` | Add reset-settings action that preserves tapes and playback data. |
| ST-GAP-061 | Export naming | Exported files do not encode enough context for repeated backups. | `src/state/store.ts`, `src/shared/dataTransfer.ts` | Include app name, format, local date, and selected language-safe slug in export filenames. |
| ST-GAP-062 | Capture shortcut discoverability | The Edit tab shows capture buttons but does not make the effective keyboard shortcuts visible near the controls. | `src/screens/Capture.tsx`, `manifest.json`, `src/state/storage.ts` | Add subtle shortcut labels using the manifest-backed read-only shortcut settings. |
| ST-GAP-063 | Edit search | The Edit tab can become long, but there is no search/filter field for clips inside one tape. | `src/screens/Capture.tsx`, `src/state/store.ts` | Add per-tape clip search by title, source, note, and time range. |
| ST-GAP-064 | Batch clip actions | Copy, move, and delete are per-row only. Bulk cleanup requires repeated menu interactions. | `src/screens/Capture.tsx`, `src/state/store.ts`, `src/shared/reorder.ts` | Add multi-select mode with batch copy, move, and delete. |
| ST-GAP-065 | Duplicate clip action | Users can duplicate entire tapes, but not a single useful clip/range. | `src/screens/Capture.tsx`, `src/state/store.ts` | Add duplicate segment action that creates a new id and preserves range/title/note. |
| ST-GAP-067 | Merge preview | Mixtape merge is available, but users do not get a preview of clip counts, duplicate-looking ranges, or resulting name/order before confirming. | `src/screens/Home.tsx`, `src/state/store.ts` | Add a merge preview confirmation with source/target summary. |
| ST-GAP-068 | Playback mode per tape | Shuffle default is global only. Some tapes naturally want sequence, shuffle, or repeat behavior. | `src/shared/types.ts`, `src/state/store.ts`, `src/screens/Home.tsx`, `src/screens/Playback.tsx` | Add optional per-mixtape playback preference with global fallback. |
| ST-GAP-069 | Last played position | A tape does not remember which clip was last played once playback stops. | `src/shared/types.ts`, `src/shared/storage.ts`, `src/screens/Home.tsx` | Store lightweight last-played metadata and expose a resume action. |
| ST-GAP-070 | Queue save-as | Edited session queues are temporary unless the user manually applies queue edit back to the current tape. | `src/screens/Playback.tsx`, `src/state/store.ts` | Add "save queue as new tape" so experimental playback order can become a tape without overwriting the original. |
| ST-GAP-071 | Edit totals | Edit does not summarize selected tape duration, clip count after filters, or average clip duration. | `src/screens/Capture.tsx`, `src/shared/time.ts` | Add small metadata line near save target once search/filter exists. |
| ST-GAP-072 | Source actions | Saved clips do not expose copy/open source URL actions directly from Edit. | `src/screens/Capture.tsx`, `src/shared/youtube.ts` | Add copy URL and open source actions to segment menu. |
| ST-GAP-073 | Empty states | Empty states exist, but copy is generic and not tailored per route, import state, or selected language nuance. | `src/screens/Home.tsx`, `src/screens/Capture.tsx`, `src/screens/Playback.tsx`, `src/i18n.ts` | Add route-specific empty states that point to the next real action. |
| ST-GAP-074 | Edit tab video awareness | Edit detects the active video, but it does not clearly warn when the active tab changed away from the clip being edited. | `src/screens/Capture.tsx`, `src/state/store.ts` | Add a small active-video/source mismatch indicator for exact range editing. |
| ST-GAP-075 | Content resilience | Content playback handles ads and navigation, but there is no explicit coverage for mini-player, theater mode, live video, or unavailable videos. | `src/content/contentScript.ts`, `tests/contentPlayback.test.mjs` | Add fixtures or guarded tests for YouTube layout/state variants. |
| ST-GAP-076 | Diagnostics | There is no user-facing diagnostic snapshot for support: current route, selected tape, playback state, detected tab, and storage size. | `src/screens/Settings.tsx`, `src/state/store.ts` | Add copy diagnostics action in Settings, keeping private clip data summarized. |
| ST-GAP-077 | Test data factories | Tests repeatedly hand-build app state, playback state, and settings, which increases fixture drift. | `tests/*.test.mjs`, `tests/helpers.mjs` | Add shared state factories and migrate the noisiest tests first. |
| ST-GAP-078 | Runtime message tests | Runtime message behavior is covered indirectly, but the request/response contracts are not tested as a shared protocol surface. | `src/shared/types.ts`, `src/background/background.ts`, `src/content/contentScript.ts` | Add protocol-focused tests around message payloads and failure shapes. |
| ST-GAP-079 | Manual QA script | There is no single scripted checklist that matches the current product flows after playback and settings changes. | `README.md`, `docs/`, `scripts/` | Add a concise developer QA script outside README or as a command output, not as README clutter. |

## P3 Low

| ID | Area | Remaining work | Evidence | Next step |
| --- | --- | --- | --- | --- |
| ST-GAP-050 | Versioning | Version bump and changelog flow are still manual. | `package.json`, `manifest.json`, `README.md` | Add a lightweight release note template after package script exists. |
| ST-GAP-080 | Store screenshots | There is no tracked plan for the required Chrome Web Store screenshots. | `docs/`, `dist/` | Define the 3-5 screenshots to capture after UI stabilizes. |
| ST-GAP-081 | First-run onboarding | First launch depends on empty states only. There is no guided path from "open YouTube" to "first saved tape." | `src/screens/Home.tsx`, `src/screens/Capture.tsx` | Add a minimal first-run checklist only if empty-state copy is not enough. |
| ST-GAP-082 | Privacy copy | The extension stores local clip metadata, but there is no standalone privacy statement draft. | `README.md`, `manifest.json` | Draft a local-only privacy statement for store listing use. |
| ST-GAP-083 | Permission audit | Manifest permissions have not been reviewed against current feature usage after popup removal and playback changes. | `manifest.json`, `src/background/background.ts` | Re-check permissions and remove anything no longer required. |
| ST-GAP-084 | Icon variant audit | The previous icon direction was rejected, but there is no documented style target for the next attempt. | `public/icons`, `manifest.json` | Write a short icon brief from the user's two accepted reference directions. |
| ST-GAP-085 | CSS token audit | UI has improved, but token usage may still drift across ad hoc inline styles. | `src/theme/tokens.ts`, `src/screens/*.tsx`, `src/components/*.tsx` | Audit repeated color/spacing literals and fold them into existing tokens only where useful. |
| ST-GAP-086 | Error log export | When something goes wrong, users cannot export recent runtime notices or storage state summaries. | `src/state/store.ts`, `src/screens/Settings.tsx` | Add a debug export if diagnostics are not enough. |
| ST-GAP-087 | CSV import | CSV export exists, but CSV import is not supported. | `src/shared/dataTransfer.ts`, `src/state/store.ts` | Defer unless the user starts editing data outside the extension. |
| ST-GAP-088 | Drag-and-drop import | Import requires file picker flow only. | `src/screens/Settings.tsx` | Add drag-and-drop import zone after import preview is safe. |
| ST-GAP-089 | Large library performance | Lists render directly and may get heavy with many tapes/clips. | `src/screens/Home.tsx`, `src/screens/Capture.tsx`, `src/screens/Playback.tsx` | Add performance tests before considering virtualization. |
| ST-GAP-091 | Focus ring polish | Focus states exist through native behavior and inline styles, but there is no visual audit across themes. | `src/screens/*.tsx`, `src/sidepanel/styles.css` | Run focus-ring visual pass after keyboard QA tests. |
| ST-GAP-092 | Narrow-width sweep | Side panel layouts are tested mostly by DOM expectations, not visual width sweeps. | `src/screens/*.tsx`, `tests/*Screen.test.mjs` | Add narrow-width screenshot checks when browser QA exists. |
| ST-GAP-093 | Architecture notes | README is intentionally concise, but there is no short developer architecture note for future work. | `README.md`, `src/` | Add a separate `docs/architecture.md` if onboarding becomes slow. |
| ST-GAP-094 | All-check script | Developers currently run test and build separately. | `package.json`, `scripts/` | Add `npm run check` that runs tests and build in the expected order. |
| ST-GAP-095 | Dependency hygiene | The npx-first TypeScript flow works, but tool versions and local dependency assumptions are not summarized in one place. | `package.json`, `scripts/`, `README.md` | Add a short dev environment note outside README if the workflow grows. |

## Removed From Active Backlog

- All previously tracked `ST-BUG-*` items are considered fixed and are no longer listed here.
- Completed settings, mixtape management, rendering, storage, language, queue-separation, capture status, exact saved-range editing, playback seek/pause/resume, playback queue row actions, playback target readiness, playback error visibility, playback recovery, and closed-panel command coverage work has been removed from the active table.
- Shorts/embed support was removed from the active backlog because the current MVP manifest and parser target YouTube watch pages only.

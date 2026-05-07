# SnackTape Bug and Completion Audit

Date: 2026-05-07

Scope: repository audit only. This document does not implement fixes. It separates likely defects from unfinished product work so the next implementation pass can be prioritized without re-discovering the same issues.

Counts:

- Potential bugs and regressions: 50 total, 34 fixed, 16 open
- Unfinished areas and follow-up work: 50 total, 12 fixed, 38 open

## Priority Summary

Fix first:

- `ST-BUG-011` through `ST-BUG-014`: time, validation, empty-store, and localization problems still affect shared data quality.
- `ST-BUG-029` and `ST-BUG-034` through `ST-BUG-037`: remaining command and YouTube-surface edge cases need product decisions or browser-level QA.
- `ST-GAP-013` through `ST-GAP-015`: remaining visible edit/playback surfaces that render controls without complete behavior.

## Fixed Bugs

| ID | Area | Fixed result | Evidence | Keep covered by |
| --- | --- | --- | --- | --- |
| ST-BUG-001 | Rendering | Active keyed form controls are no longer destroyed blindly during app rerenders; stable selects are moved forward and stable inputs restore draft value/caret/focus. | `src/components/dom.ts:87-188`, `src/screens/Capture.tsx:381-410`, `src/screens/Settings.tsx:181-217` | `tests/dom.test.mjs` |
| ST-BUG-002 | Rendering | The preservation layer now restores active input focus/caret and keeps native select nodes alive while their option identity is unchanged. | `src/components/dom.ts:121-188` | `tests/dom.test.mjs` |
| ST-BUG-003 | Menus | Segment action menus no longer re-open after edit/delete actions because open `<details>` state is not restored for closing actions. | `src/components/dom.ts:202-229`, `src/screens/Capture.tsx:89-155` | `tests/captureScreen.test.mjs` |
| ST-BUG-004 | Queue editing | Playback now has a separate queue-edit entry point wired to `beginQueueEdit`, while the existing mixtape edit button still routes to the Edit tab. | `src/screens/Playback.tsx:493-512`, `src/App.tsx:51-58` | `tests/playbackScreen.test.mjs` |
| ST-BUG-005 | Queue editing | The Playback queue header renders the computed up-next count instead of leaving it dead. | `src/screens/Playback.tsx:277-284`, `src/screens/Playback.tsx:489-491` | `tests/playbackScreen.test.mjs` |
| ST-BUG-006 | Drag and drop | Queue drag reorder no longer depends on a render-local `draggedIndex`; drop uses `dataTransfer` so a rerender during drag keeps the source index. | `src/screens/Playback.tsx:468-480` | `tests/playbackScreen.test.mjs` |
| ST-BUG-007 | Queue editing | Queue edit state records the base segment ids and appends clips added after editing started, so stale saves do not drop new clips. | `src/state/store.ts:483-550`, `src/shared/reorder.ts:48-75` | `tests/reorder.test.mjs`, `tests/storeRouting.test.mjs` |
| ST-BUG-008 | Playback mode | Sequence and queue edits preserve active shuffle playback instead of resetting to `sequence`. | `src/shared/playback.ts:166-183` | `tests/playback.test.mjs`, `tests/storeRouting.test.mjs` |
| ST-BUG-009 | Playback progress | Playback progress now prefers live YouTube page time when available, and background anchors `startedAt` to the content script's current time after playback starts. | `src/screens/Playback.tsx:75-110`, `src/background/background.ts:289-306` | `tests/playbackScreen.test.mjs`, `tests/backgroundPlaybackMode.test.mjs` |
| ST-BUG-010 | Playback progress | Autoplay-blocked segments are stored as `waiting`, the UI stops progress animation in that state, and content promotes the state only after the continue action succeeds. | `src/content/contentScript.ts:187-201`, `src/background/background.ts:358-377`, `src/screens/Playback.tsx:117-124` | `tests/contentPlayback.test.mjs`, `tests/backgroundPlaybackMode.test.mjs`, `tests/playbackScreen.test.mjs` |
| ST-BUG-015 | Settings state | `updateSettings` normalizes merged patches before publishing visible state or saving storage. | `src/state/store.ts:555-558`, `src/state/storage.ts:43-55` | `tests/storeRouting.test.mjs` |
| ST-BUG-016 | Settings state | Deleting the mixtape used as the default save target clears `defaultMixtapeId` in state and storage. | `src/state/store.ts:258-293` | `tests/storeRouting.test.mjs` |
| ST-BUG-017 | Settings state | Shortcut settings canonicalize to the manifest command defaults instead of preserving arbitrary stored strings. | `src/state/storage.ts:16-54`, `manifest.json:26-43` | `tests/settingsState.test.mjs` |
| ST-BUG-018 | Capture | `captureIn` publishes a cached IN marker before active-video refresh and keeps it if YouTube cannot be read. | `src/state/store.ts:591-617` | `tests/storeCapture.test.mjs` |
| ST-BUG-019 | Capture | `captureOutAndSave` uses cached page info as a fallback and stores inline capture notices for missing preconditions. | `src/state/store.ts:645-727`, `src/screens/Capture.tsx:773-791` | `tests/storeCapture.test.mjs`, `tests/captureScreen.test.mjs` |
| ST-BUG-020 | Capture | `autoTitleFromCaptions=false` disables automatic title inference and saves a generated YouTube title instead. | `src/state/store.ts:716-723` | `tests/storeCapture.test.mjs` |
| ST-BUG-021 | Routing | Opening a different filled mixtape clears stale playback state and sends a runtime stop so Playback renders the selected mixtape instead of the old active sequence. | `src/state/store.ts:213-242` | `tests/storeRouting.test.mjs` |
| ST-BUG-022 | Playback handoff | `startSequence` now publishes an explicit pending state and rolls back if the runtime handoff fails instead of leaving a false Playback screen. | `src/state/store.ts:866-933` | `tests/storeRouting.test.mjs` |
| ST-BUG-023 | Runtime errors | Store playback actions now check runtime responses; failed starts roll back and failed next/stop calls no longer get silently treated as success. | `src/state/store.ts:924-950`, `src/background/background.ts:177-201` | `tests/storeRouting.test.mjs`, `tests/backgroundPlaybackMode.test.mjs` |
| ST-BUG-024 | Playback target | Background playback only reuses requested/active tabs that are YouTube video candidates, otherwise it reuses or creates a YouTube tab. | `src/background/background.ts:126-143` | `tests/backgroundPlaybackMode.test.mjs` |
| ST-BUG-025 | Playback state | Background no longer saves `playing` before content handoff succeeds; it saves `playing` or `waiting` only after `PLAY_SEGMENT` responds. | `src/background/background.ts:266-306` | `tests/backgroundPlaybackMode.test.mjs` |
| ST-BUG-026 | Cross-video playback | Cross-video handoff waits for the target tab's update-complete event instead of sleeping for a fixed 700 ms. | `src/background/background.ts:150-175`, `src/background/background.ts:282-286` | `tests/backgroundPlaybackMode.test.mjs` |
| ST-BUG-027 | Sequence deletion | Advancing after the backing sequence was deleted now stops playback and clears state instead of throwing through the segment-ended path. | `src/background/background.ts:316-356` | `tests/backgroundPlaybackMode.test.mjs` |
| ST-BUG-028 | Dead command | Removed the stale `OPEN_EDITOR` message type and background options-page branch. | `src/shared/types.ts:70-86`, `src/background/background.ts:397-423` | `tests/manifest.test.mjs`, `tests/backgroundPlaybackMode.test.mjs` |
| ST-BUG-030 | Content playback | Content playback now assigns the active token only after video/ad readiness succeeds and clears local playback state on setup failure. | `src/content/contentScript.ts:204-266` | `tests/contentPlayback.test.mjs` |
| ST-BUG-031 | Content playback | YouTube navigation away from the active video sends `STOP_SEQUENCE` so background playback state is cleared too. | `src/content/contentScript.ts:323-331` | `tests/contentPlayback.test.mjs` |
| ST-BUG-032 | Segment end timing | Content playback now finishes at the saved OUT boundary instead of `endSeconds - 0.15`. | `src/content/contentScript.ts:249-250` | `tests/contentPlayback.test.mjs` |
| ST-BUG-033 | Ad wait | Ad playback handoff now reports `waiting` immediately, keeps a cancellable active token, starts the segment after ads clear, and promotes background state with `PLAYBACK_STARTED`. | `src/content/contentScript.ts:266-305` | `tests/contentPlayback.test.mjs` |
| ST-BUG-038 | Active-video detection | Tab/window/focus detection now coalesces refreshes into one scheduled sync, and `refreshVideo` skips state publication when the detected video data is unchanged. | `src/state/videoDetection.ts:25-42`, `src/state/store.ts:100-116`, `src/state/store.ts:561-570` | `tests/videoDetection.test.mjs`, `tests/storeCapture.test.mjs` |
| ST-BUG-041 | Delete flow | Deleting a mixtape or active segment now sends a runtime stop before clearing playback storage, so content playback does not keep running with orphaned state. | `src/state/store.ts:330-352`, `src/state/store.ts:442-480` | `tests/storeRouting.test.mjs` |
| ST-BUG-045 | Native select | Save-target and Settings selects now carry stable `data-persist-key` identities, so active native selects survive rerenders unless the option list changes. | `src/components/dom.ts:147-159`, `src/screens/Capture.tsx:381-410`, `src/screens/Settings.tsx:181-217` | `tests/dom.test.mjs`, `tests/captureScreen.test.mjs`, `tests/settingsScreen.test.mjs` |
| ST-BUG-046 | Thumb rendering | Thumbnails now render as lazy `<img>` elements and remove the failed image while marking fallback state on load error. | `src/components/Thumb.tsx:22-43` | `tests/thumb.test.mjs` |
| ST-BUG-048 | Previous control | Previous is disabled at the first clip instead of replaying index 0. | `src/screens/Playback.tsx:277-284`, `src/screens/Playback.tsx:438-443` | `tests/playbackScreen.test.mjs` |
| ST-BUG-049 | Next control | Next is disabled at the queue boundary instead of replaying the final clip when there is no next item. | `src/screens/Playback.tsx:277-284`, `src/screens/Playback.tsx:465-470` | `tests/playbackScreen.test.mjs` |

## Open Bugs

| ID | Area | Finding | Evidence | Recommended next step |
| --- | --- | --- | --- | --- |
| ST-BUG-011 | Time display | Several duration helpers treat `endSeconds: 0` as "missing" because they use truthiness checks. | `src/screens/Capture.tsx:37-43`, `src/screens/Capture.tsx:812-815`, `src/screens/Playback.tsx:58-72`, `src/screens/Home.tsx:19-26` | Use `endSeconds === null` checks everywhere. |
| ST-BUG-012 | Validation | Imported or normalized segments can keep `endSeconds <= startSeconds`; validation only blocks playback later. | `src/shared/storage.ts:73-96`, `src/shared/validation.ts:22-28` | Validate on import/save and surface repair errors. |
| ST-BUG-013 | Storage normalization | `normalizeStore` can return an empty sequence list, but several UI paths still assume a selected sequence exists. | `src/shared/storage.ts:118-147`, `src/screens/Capture.tsx:516-526` | Audit empty-store behavior across Edit, Home, Playback, and Settings. |
| ST-BUG-014 | Localization | Default sequence and fallback segment titles are still hard-coded Korean strings, regardless of language setting. | `src/shared/storage.ts:10-39`, `src/shared/storage.ts:83-90`, `src/shared/storage.ts:109-115` | Move fallback naming through i18n or store neutral generated names. |
| ST-BUG-029 | Keyboard commands | Chrome commands are sent to extension views through `chrome.runtime.sendMessage`; if the side panel is closed, capture commands have no store receiver. | `src/background/background.ts:360-367`, `src/main.tsx:27-31`, `src/state/store.ts:724-737` | Handle capture commands in the background/content path or open/focus the side panel first. |
| ST-BUG-034 | YouTube surfaces | The parser supports Shorts and embed URLs, but the manifest and page-info check only support `/watch`, creating inconsistent behavior. | `src/shared/youtube.ts:36-43`, `src/content/contentScript.ts:155-166`, `manifest.json:19-24` | Decide scope and make parser, manifest, and UI agree. |
| ST-BUG-035 | Content title | YouTube title extraction depends on one selector and a document-title fallback; DOM changes can degrade saved titles silently. | `src/content/contentScript.ts:127-135` | Add selector tests and fallback behavior that marks uncertain titles. |
| ST-BUG-036 | Overlay | The autoplay overlay uses hard-coded copy and colors, outside the active theme and language. | `src/content/overlay.ts:7-45` | Localize and theme the overlay, or keep it intentionally browser-native but documented. |
| ST-BUG-037 | Overlay retry | If the overlay continue action fails, it updates text but does not expose a second recovery path or close state. | `src/content/overlay.ts:37-40` | Keep the button actionable and expose a clear manual instruction. |
| ST-BUG-039 | Active-video refresh | `refreshVideo` has no try/catch around active-video detection; callers can reject with no UI fallback. | `src/state/store.ts:502-508`, `src/state/youtube.ts:105-135` | Convert failures into state errors that the Edit tab can render. |
| ST-BUG-040 | Storage errors | Storage writes are awaited, but most UI actions do not catch write failures or revert optimistic state. | `src/shared/storage.ts:177-188`, `src/state/store.ts:137-711` | Add write-error handling with rollback or retry. |
| ST-BUG-042 | Empty store | Final mixtape deletion routes Home with no sequences, but Capture still has no create-target affordance if reached through route changes. | `src/state/store.ts:271-287`, `src/screens/Capture.tsx:546-556` | Guard Edit route when no sequences exist or provide a create-target action. |
| ST-BUG-043 | Current time | Edit tab displays current time from the last detection snapshot; it does not continuously tick with the video. | `src/screens/Capture.tsx:516-526`, `src/screens/Capture.tsx:572-606`, `src/state/videoDetection.ts:23-48` | Subscribe to video time while Edit is active or refresh on button press with immediate visual feedback. |
| ST-BUG-044 | Accessibility | Custom controls often use visual state without `aria-pressed`, `aria-expanded`, or described error states. | `src/screens/Settings.tsx:88-123`, `src/screens/Capture.tsx:89-155`, `src/screens/Playback.tsx:388-420` | Add semantic state to toggles, menus, and playback controls. |
| ST-BUG-047 | Time rounding | Capture and storage round to 0.01 seconds, but frame nudges use 1/30 seconds, so repeated nudges can accumulate rounded drift. | `src/state/store.ts:63-67`, `src/state/store.ts:178-182`, `src/state/store.ts:318-368` | Store higher precision internally and format only at render time. |
| ST-BUG-050 | Build output | `dist/` is ignored and currently absent after clean/test flows, so local Chrome load-unpacked can fail until a fresh build is run. | `.gitignore:4-7`, `scripts/clean.mjs:1-6`, `scripts/build.mjs:29-54` | Make the required build step explicit in handoff/README or add a local smoke check before load-unpacked QA. |

## Unfinished Areas and Follow-Up Work

| ID | Area | Missing or incomplete area | Evidence | Recommended next step |
| --- | --- | --- | --- | --- |
| ST-GAP-001 | Settings | Fixed: Settings export now downloads JSON backups and CSV clip rows from the side panel. | `src/state/store.ts:607-616`, `src/shared/dataTransfer.ts`, `src/screens/Settings.tsx:528-538` | Keep export serialization and Settings action wiring tests. |
| ST-GAP-002 | Settings | Fixed: Settings import now opens a JSON picker, validates the payload, replaces the store, and shows inline status. | `src/App.tsx:11-21`, `src/state/store.ts:619-649`, `src/shared/dataTransfer.ts` | Keep import success and invalid-file regression tests. |
| ST-GAP-003 | Settings | Fixed: Delete-all now confirms, clears mixtapes, playback state, draft state, and stale default save location. | `src/App.tsx:81-86`, `src/state/store.ts:652-673` | Keep destructive-action storage cleanup tests. |
| ST-GAP-004 | Settings | Fixed: Default save location is a native Settings select that writes `defaultMixtapeId`. | `src/screens/Settings.tsx:145-200`, `src/state/store.ts:599-605` | Keep Settings select wiring and state persistence tests. |
| ST-GAP-005 | Settings | Fixed: Shortcut rows now explain that shortcuts are managed in Chrome extension shortcuts. | `src/screens/Settings.tsx:517-518`, `src/i18n.ts` | Keep Settings copy tests for shortcut help text. |
| ST-GAP-006 | Settings | Fixed: `autoTitleFromCaptions=false` now disables automatic video-title inference during capture. | `src/state/store.ts:819-826`, `tests/storeCapture.test.mjs` | Add richer caption/chapter extraction later if needed. |
| ST-GAP-007 | Settings | Fixed: background playback sends `fadeOut` to content playback, and the content script fades video volume near the segment end. | `src/background/background.ts:253-260`, `src/content/contentScript.ts:199-252` | Keep background fade-message coverage and add browser playback QA later. |
| ST-GAP-008 | Settings | Fixed: background playback respects `autoNext=false` by stopping after the current segment ends. | `src/background/background.ts:282-286`, `tests/backgroundPlaybackMode.test.mjs` | Keep auto-next disabled coverage. |
| ST-GAP-009 | Settings | Fixed: background playback reads `shuffleByDefault` when a start request does not provide an explicit mode. | `src/background/background.ts:71-74`, `tests/backgroundPlaybackMode.test.mjs` | Keep side-panel and background default-mode coverage. |
| ST-GAP-010 | Data | Fixed: JSON and CSV export/import are now available from the current side panel instead of only the legacy editor. | `src/screens/Settings.tsx:528-540`, `src/state/store.ts:607-649`, `src/shared/dataTransfer.ts` | Keep data transfer tests and side-panel action wiring covered. |
| ST-GAP-011 | Legacy source | Fixed: removed the unused `src/editor/*` source and stale README/test references; the MV3 app is side-panel only. | `README.md:19`, `manifest.json:12-18`, `tests/manifest.test.mjs:40-44` | Keep the legacy-source absence test. |
| ST-GAP-012 | Queue editing | Fixed: Playback exposes a queue-edit path while preserving the separate mixtape-edit flow into the Edit tab. | `src/screens/Playback.tsx:493-512`, `src/App.tsx:51-58` | Keep queue-edit entry and mixtape-edit routing tests. |
| ST-GAP-013 | Queue editing | Queue edit supports reorder/remove but not direct segment time edits inside the Playback queue. | `src/screens/Playback.tsx:462-550`, `src/screens/Capture.tsx:172-243` | Keep time editing in Edit tab or add an inline range editor in queue edit. |
| ST-GAP-014 | Segment editing | Segment range editing is nudge-only; there is no direct time input. | `src/screens/Capture.tsx:172-243` | Add exact start/end text fields with validation and keyboard commit. |
| ST-GAP-015 | Segment editing | Segment deletion has no undo or confirmation, despite permanently mutating local storage. | `src/screens/Capture.tsx:143-151`, `src/state/store.ts:371-408` | Add undo, confirmation, or a short-lived recovery affordance that matches the template. |
| ST-GAP-016 | Mixtapes | Home cards do not expose rename/delete/edit actions directly; users must enter Playback or Edit first. | `src/screens/Home.tsx:100-210`, `src/screens/Capture.tsx:246-340`, `src/screens/Playback.tsx:293-301` | Add a template-aligned card menu if Home is meant to manage mixtapes. |
| ST-GAP-017 | Mixtapes | There is no duplicate/copy mixtape flow. | `src/state/store.ts:137-287` | Add copy if users need variants of the same queue. |
| ST-GAP-018 | Mixtapes | There is no merge or move-clips-between-mixtapes flow. | `src/state/store.ts:290-408` | Add "move to" or "copy to" actions for saved segments. |
| ST-GAP-019 | Mixtapes | There is no sorting option for many mixtapes beyond insertion order. | `src/screens/Home.tsx:260-307` | Add sort by recent update, name, clip count, or manual order. |
| ST-GAP-020 | Mixtapes | There is no search/filter for large mixtape libraries. | `src/screens/Home.tsx:260-307` | Add local search once card count becomes large. |
| ST-GAP-021 | Mixtapes | Mixtape creation names use count-based numbering, which can repeat names after deletion. | `src/state/store.ts:137-158` | Generate the next unused visible number or open rename immediately. |
| ST-GAP-022 | Capture | Edit tab has no create-mixtape affordance when there are no sequences but the route is still reachable. | `src/state/store.ts:256-287`, `src/screens/Capture.tsx:546-556` | Add create-target UI or redirect to Home when store is empty. |
| ST-GAP-023 | Capture | Capture guards fail silently instead of explaining whether the active tab is missing, not YouTube, unreadable, or has no current time. | `src/state/store.ts:557-620`, `src/state/youtube.ts:105-135` | Add inline error/status area in the template. |
| ST-GAP-024 | Capture | Saved clip cards show only title and range; there is no thumbnail in the Edit list, unlike Playback queue and Home covers. | `src/screens/Capture.tsx:752-839` | Add compact thumbnails if the template expects visual continuity. |
| ST-GAP-025 | Capture | The Edit tab does not show the active channel metadata even though content script reads it. | `src/content/contentScript.ts:137-152`, `src/screens/Capture.tsx:557-614` | Surface channel when useful or remove it from `VideoState`. |
| ST-GAP-026 | Capture | The nudge buttons adjust only the draft IN point, not a draft OUT preview before save. | `src/screens/Capture.tsx:714-737`, `src/state/store.ts:576-599` | Add draft OUT preview controls if users need pre-save precision. |
| ST-GAP-027 | Capture | There is no "cancel current IN" button; users can only overwrite it or save OUT. | `src/state/store.ts:557-599`, `src/screens/Capture.tsx:840-889` | Add a clear-draft action. |
| ST-GAP-028 | Capture | Capture uses only the active tab; there is no explicit tab picker when multiple YouTube videos are open. | `src/state/youtube.ts:36-39`, `src/state/videoDetection.ts:25-48` | Add active-tab explanation or a target selector if multi-tab capture matters. |
| ST-GAP-029 | Playback | Progress bar is display-only; users cannot scrub or jump within the saved range. | `src/screens/Playback.tsx:363-386` | Add range seek handling through content script. |
| ST-GAP-030 | Playback | Stop is the only pause-like control; there is no resume-from-current-time behavior. | `src/screens/Playback.tsx:393-413`, `src/state/store.ts:714-717` | Decide whether the main button is stop or pause/resume, then wire accordingly. |
| ST-GAP-031 | Playback | Shuffle, repeat, previous, and next controls have no active/disabled visual states for boundary or mode conditions. | `src/screens/Playback.tsx:388-420` | Add disabled and selected states that match real behavior. |
| ST-GAP-032 | Playback | Queue rows can start playback but cannot expose per-row menu actions unless queue edit mode is active. | `src/screens/Playback.tsx:553-608` | Add row menus for edit, remove, copy, or play-next if part of the template. |
| ST-GAP-033 | Playback | Playback screen does not show the actual target YouTube tab, tab title, or connection state. | `src/screens/Playback.tsx:247-420`, `src/background/background.ts:193-258` | Add connection/readiness state from background/content. |
| ST-GAP-034 | Playback | Playback has no clear error surface when background returns an error. | `src/state/youtube.ts:55-67`, `src/state/store.ts:666-721` | Store runtime errors and render them in the Now Playing template. |
| ST-GAP-035 | Playback | There is no "play from here to end" versus "play one clip" distinction in queue rows. | `src/screens/Playback.tsx:553-608`, `src/background/background.ts:160-190` | Clarify row click semantics and add explicit actions if needed. |
| ST-GAP-036 | Playback | There is no persisted manual queue separate from saved mixtape order; queue edit mutates the underlying mixtape. | `src/state/store.ts:411-499`, `src/shared/reorder.ts:48-65` | Decide whether queue edits are temporary session edits or permanent mixtape edits. |
| ST-GAP-037 | Playback | Background state does not model "pending", "waiting for ad", "waiting for user gesture", or "error"; it only stores playing state. | `src/shared/types.ts:21-35`, `src/background/background.ts:221-250` | Expand playback state lifecycle before improving the UI. |
| ST-GAP-038 | YouTube integration | Content script does not support themed/localized status messaging on the YouTube page. | `src/content/overlay.ts:7-45` | Pass language/theme or keep all status inside the side panel. |
| ST-GAP-039 | YouTube integration | Shorts/embed parsing exists, but the extension does not define a completed capture/playback experience for those surfaces. | `src/shared/youtube.ts:36-43`, `manifest.json:19-24` | Either complete support or remove parser branches from MVP. |
| ST-GAP-040 | Data model | Segments have an optional `note`, but the current side panel provides no note editing UI. | `src/shared/types.ts:1-11`, `src/shared/storage.ts:91-93` | Add notes or remove the field until needed. |
| ST-GAP-041 | Data model | There are no tags, categories, or source filters for clips. | `src/shared/types.ts:1-20`, `src/screens/Home.tsx:260-307` | Defer intentionally or add only after core editing stabilizes. |
| ST-GAP-042 | Data safety | There is no storage quota preflight or friendly recovery when `chrome.storage.local` writes fail. | `src/shared/storage.ts:177-188`, `src/state/store.ts:137-711` | Add quota-aware error handling before import/export/delete-all. |
| ST-GAP-043 | Data safety | There is no backup prompt before destructive operations like delete-mixtape or delete-all. | `src/App.tsx:31-38`, `src/screens/Settings.tsx:403-408` | Add optional export-before-delete for large stores. |
| ST-GAP-044 | Localization | Background, content, validation, and storage errors are not i18n-driven. | `src/background/background.ts:29-157`, `src/content/contentScript.ts:39-50`, `src/shared/validation.ts:7-52`, `src/shared/storage.ts:227-279` | Centralize user-facing strings or keep them out of user UI. |
| ST-GAP-045 | Accessibility | There is no keyboard-flow audit for Edit menus, native select, custom toggles, playback controls, and queue editing. | `src/screens/Capture.tsx:89-155`, `src/screens/Settings.tsx:88-123`, `src/screens/Playback.tsx:388-550` | Add keyboard-only QA and ARIA tests. |
| ST-GAP-046 | Testing | Current tests use lightweight DOM shims, not a real browser rendering engine. | `tests/playbackScreen.test.mjs:5-97`, `tests/captureScreen.test.mjs:1-80` | Add Playwright/Chrome smoke tests for side-panel interactions. |
| ST-GAP-047 | Testing | No test proves the unpacked `dist/` extension can be loaded by Chrome after build. | `package.json:8-14`, `scripts/build.mjs:29-54` | Add a manifest/file-existence smoke check after build. |
| ST-GAP-048 | Testing | No test covers content-script playback against real or simulated YouTube DOM changes. | `src/content/contentScript.ts:28-329`, `tests/youtubeState.test.mjs:1-80` | Add content-script unit tests with DOM fixtures and message flows. |
| ST-GAP-049 | Testing | No test covers keyboard commands when the side panel is closed. | `manifest.json:26-43`, `src/background/background.ts:360-367`, `src/main.tsx:27-31` | Add background-level command tests and decide desired behavior. |
| ST-GAP-050 | Release | There is no packaging/release script for zip/CRX artifacts or version/changelog workflow. | `package.json:8-14`, `.gitignore:9-13`, `manifest.json:1-6` | Add release scripts only after MVP behavior stabilizes. |

## Suggested Execution Order

1. Stabilize remaining shared data quality: `ST-BUG-011` through `ST-BUG-014`.
2. Decide command and YouTube-surface scope: `ST-BUG-029`, `ST-BUG-034` through `ST-BUG-037`, `ST-GAP-034`, `ST-GAP-037`.
3. Close visible non-Settings rows: `ST-GAP-013` through `ST-GAP-015`.
4. Complete remaining Playback product work: `ST-GAP-036`, `ST-GAP-046` through `ST-GAP-049`.
5. Add real browser and extension smoke coverage: `ST-GAP-046` through `ST-GAP-049`.

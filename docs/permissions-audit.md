# SnackTape Permissions Audit

Last updated: 2026-05-12

This audit checks the current Chrome extension manifest against the implemented side panel, capture, and playback flows.

## Manifest Permissions

| Permission | Status | Why It Is Needed |
| --- | --- | --- |
| `sidePanel` | Keep | Opens SnackTape as a Chrome side panel and configures the toolbar action to open the panel. |
| `storage` | Keep | Persists mixtapes, settings, playback state, and capture drafts in Chrome extension storage. |
| `tabs` | Keep | Reads the active tab, finds existing YouTube watch tabs, creates a YouTube playback tab when needed, and navigates a playback tab to the saved clip source. |
| `scripting` | Keep | Re-injects `content.js` into YouTube watch tabs when a runtime message reaches a tab before the declarative content script is ready. |

## Host Permissions

| Host Permission | Status | Why It Is Needed |
| --- | --- | --- |
| `https://*.youtube.com/*` | Keep | Allows the extension to communicate with YouTube watch pages across YouTube subdomains used by the content script and playback handoff flow. |

The declarative content script is already narrower than the host permission and runs only on `https://*.youtube.com/watch*`.

## Removed Or Avoided Permissions

SnackTape does not request broad web access, identity, cookies, browsing history, downloads, notifications, or clipboard permissions.

The extension also does not request `activeTab` because playback and capture need durable tab messaging beyond one toolbar-click gesture.

## Recheck Triggers

Re-run this audit when one of these changes happens:

- The extension adds popup UI, options pages, account features, or remote sync.
- YouTube support expands beyond normal watch pages.
- Browser QA proves that `scripting` injection is no longer needed.
- Store listing review asks for a narrower YouTube host pattern.

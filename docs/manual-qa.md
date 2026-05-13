# SnackTape Manual QA

Use this checklist before store packaging or after changes that touch rendering, keyboard behavior, localization, or extension runtime wiring.

## Keyboard

- Open the side panel with only the keyboard.
- Tab through Edit, Mixtapes, and Settings without losing focus.
- Open and close mixtape action menus with Enter, Space, and Escape.
- Open and close saved clip action menus with Enter, Space, and Escape.
- In Playback queue edit mode, move focus through reorder, remove, cancel, and save controls.

## Localization

- Switch Settings language to Korean, English, and Japanese.
- Confirm tab labels, Settings sections, capture notices, and playback notices use the selected language.
- Reload the extension and confirm the selected language persists.
- Confirm Chrome extension metadata exists for English, Korean, and Japanese.

## Extension Load

- Run `npm run build`.
- Load `dist/` through `chrome://extensions`.
- Open a YouTube watch page, then confirm the Edit tab detects the current video.
- Create one tape, capture one range, play it, and use Settings export.

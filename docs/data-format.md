# SnackTape Data Format

SnackTape stores all user data locally in Chrome extension storage. JSON export is the backup and migration format. CSV export is a spreadsheet-friendly reporting format and is not imported back into the app.

## JSON Export

The current JSON wrapper is:

```json
{
  "app": "SnackTape",
  "version": 1,
  "exportedAt": "2026-05-13T00:00:00.000Z",
  "store": {
    "sequences": [],
    "selectedSequenceId": null
  }
}
```

`app` must be `SnackTape` and `version` must be `1`. Wrapped exports with another app name or schema version are rejected instead of being guessed into the current store shape.

For compatibility with early local builds, SnackTape also accepts a plain store object with `sequences` and `selectedSequenceId`, plus the legacy single-mixtape object shape with a top-level `segments` array.

## Store Shape

`sequences` is the mixtape list. Each sequence contains:

- `id`
- `name`
- `segments`
- `createdAt`
- `updatedAt`

Each segment contains:

- `id`
- `videoId`
- `originalUrl`
- `title`
- `channel`
- `startSeconds`
- `endSeconds`
- `note`
- `createdAt`
- `updatedAt`

`endSeconds` can be `null` for open-ended playback. Imported segments are normalized before use, and invalid ranges are dropped.

## CSV Export

CSV export writes one row per saved segment with these columns:

```text
mixtape,title,videoId,channel,originalUrl,startSeconds,endSeconds,note,createdAt,updatedAt
```

Cells that could be interpreted as spreadsheet formulas are prefixed before export. This keeps CSV useful for review while avoiding formula execution when opened in spreadsheet apps.

# SnackTape Privacy Statement

Last updated: 2026-05-12

SnackTape is a Chrome extension for saving and replaying user-selected YouTube clip ranges as local mixtapes.

## Data Stored Locally

SnackTape stores the following data in Chrome extension storage on the user's device:

- Mixtape names.
- Saved clip metadata, including YouTube video ID, source URL, title, start time, end time, and optional note fields.
- Playback state needed to resume or control the current local playback session.
- User settings such as language, accent color, playback preferences, and default save location.

## Data Not Collected

SnackTape does not collect, sell, transmit, or share personal data with the developer or third parties.

SnackTape does not operate a remote server, analytics service, advertising network, or account system.

## YouTube Page Access

SnackTape reads the active YouTube page only to:

- Detect the current video title, URL, ID, duration, and playback time.
- Seek, play, pause, and stop the YouTube player when the user starts a saved clip.
- Capture IN and OUT timestamps when the user explicitly uses capture commands.

This information is used inside the extension and saved only to local Chrome extension storage unless the user exports a backup file.

## Backups and Imports

Users can export SnackTape data as JSON or CSV files. Those files are created locally through the browser download flow. Users are responsible for where exported files are stored or shared.

Users can import a JSON backup file. Imported data replaces the local SnackTape library after the user chooses that file.

## Permissions

SnackTape requests Chrome permissions required for the side panel, local storage, active tab detection, YouTube page messaging, and playback control on YouTube watch pages.

## Contact

For questions about this privacy statement, contact the project maintainer through the SnackTape GitHub repository.

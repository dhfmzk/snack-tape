const sections = [
  {
    title: 'Load unpacked extension',
    checks: [
      'Run npm run build and load dist/ from chrome://extensions with Developer mode enabled.',
      'Confirm the side panel opens from the SnackTape toolbar action.',
      'Confirm the tab order is Edit, Mixtape, Settings.',
    ],
  },
  {
    title: 'Edit capture flow',
    checks: [
      'Open a YouTube watch page and confirm the Edit tab detects title, time, duration, and thumbnail.',
      'Choose a save location, press IN, press OUT, nudge IN/OUT by frame and second, then save.',
      'Clear an in-progress draft and confirm the visible draft state disappears immediately.',
      'Edit a saved clip range, cancel, edit again, save, then delete the clip through the row menu.',
    ],
  },
  {
    title: 'Mixtape management',
    checks: [
      'Create, rename, duplicate, merge, and delete mixtapes, including deleting the final mixtape.',
      'Use search and sort controls, then confirm card spacing and scroll behavior remain stable.',
      'Open an empty mixtape and confirm it routes to Edit with that tape selected as the save target.',
    ],
  },
  {
    title: 'Playback',
    checks: [
      'Start sequence playback, shuffle playback, and repeat-current playback from the Mixtape tab.',
      'Seek with the progress bar and keyboard arrows, then pause/resume and stop.',
      'Use previous/next, play-from-row, repeat-row, row edit, and row remove actions.',
      'Edit queue order, save it, and confirm playback continues from the displayed queue order.',
      'Refresh or navigate the YouTube tab during playback and confirm reconnect copy explains the target tape, mode, and queue.',
    ],
  },
  {
    title: 'Settings and data',
    checks: [
      'Switch language between Korean, English, and Japanese; verify control sizes do not jump.',
      'Switch every accent color and confirm active controls, scrollbars, and playback UI update.',
      'Toggle playback/capture settings and confirm they persist after reopening the side panel.',
      'Export JSON and CSV, import a valid JSON backup, reject an invalid JSON file, and delete all data after confirming backup prompt behavior.',
    ],
  },
];

console.log('SnackTape manual QA checklist');
console.log('=============================');
console.log('');

for (const section of sections) {
  console.log(section.title);
  for (const check of section.checks) {
    console.log(`- [ ] ${check}`);
  }
  console.log('');
}

#!/usr/bin/env node
'use strict';

// gstack-pilot plugin - SessionEnd hook (new; role-modes has no
// equivalent). SessionEnd has NO Claude-visible decision control at all -
// confirmed against this plugin's own reference project's session-end.ps1,
// which documents the same real constraint plainly: it's a fast, fire-and-
// forget budget (short timeout), stderr-only, human-visible reminder - not
// a way to inject context back into Claude's next turn (there is no next
// turn in this session by the time SessionEnd fires). Do not add JSON
// hookSpecificOutput/additionalContext here - it would not be consumed.
//
// This hook is therefore a human safety net only. The actual Claude-visible
// enforcement of "PR-first, no trivial-housekeeping exemption" lives in
// commands/execute.md's own prose (Claude reads and follows that file
// directly while in Execute mode) - this hook just reminds the human at the
// terminal in case that chain didn't actually run before the session ends.

const fs = require('fs');
const path = require('path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateFile = path.join(projectDir, '.claude', 'hooks', 'state', 'mode.json');

let mode = null;
try {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (state.mode) mode = state.mode;
} catch (err) {
  // No readable mode state - nothing to remind about, stay silent.
}

if (mode === 'commander' || mode === 'execute') {
  process.stderr.write(
    'gstack-pilot: session ended in ' + mode + ' mode - remember this plugin\'s ' +
    'wrap-up is PR-first for every change, no trivial-housekeeping exemption: state-' +
    'doc/decision-log updates committed on a feature branch, PR opened, gstack\'s ' +
    'review -> qa -> ship chain actually run, before merging. If that did not happen ' +
    'this session, it still needs to before the work is really done.\n'
  );
}

process.exit(0);

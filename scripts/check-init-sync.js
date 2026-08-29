#!/usr/bin/env node
'use strict';

// Verifies commands/init.md's embedded CLAUDE.md starter block is
// byte-identical to what hooks/session-start.js's seedClaudeMd() actually
// writes. The two copies exist only because a slash-command can't
// require() the hook file (${CLAUDE_PLUGIN_ROOT} is hooks/MCP/LSP/monitor-
// only, not readable from a command's execution context) - see the
// MAINTENANCE comment in both files. This script is the enforcement a
// comment alone can't provide: run it after editing the starter block's
// wording in either file, before committing. No CI wired up yet in this
// repo, so it's a manual pre-commit check for now, not an automated gate.
//
// Ground truth comes from actually running the hook against a throwaway
// project dir and reading back what it wrote - not from re-parsing the JS
// source - so this exercises the real code path instead of guessing at it.
// Ported verbatim in mechanism from the sibling `role-modes` plugin's own
// script, marker string updated for this plugin.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const hookPath = path.join(repoRoot, 'hooks', 'session-start.js');
const cmdPath = path.join(repoRoot, 'commands', 'init.md');
const marker = '<!-- gstack-pilot-plugin:v1 -->';

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-pilot-sync-check-'));

try {
  execFileSync(process.execPath, [hookPath], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: scratchDir },
    stdio: 'ignore'
  });

  const actual = fs.readFileSync(path.join(scratchDir, '.claude', 'CLAUDE.md'), 'utf8').trim();

  const cmdSrc = fs.readFileSync(cmdPath, 'utf8');
  const fenceRe = new RegExp('```\\n(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\n```');
  const fenceMatch = cmdSrc.match(fenceRe);

  if (!fenceMatch) {
    console.error('FAIL: could not find the fenced starter block in commands/init.md');
    process.exit(1);
  }

  const embedded = fenceMatch[1].trim();

  if (actual === embedded) {
    console.log('OK: commands/init.md\'s starter block matches the real hook output.');
  } else {
    console.error('FAIL: commands/init.md has drifted from hooks/session-start.js\'s seedClaudeMd() output.');
    console.error('Re-copy the block from a fresh run (see the ground-truth method this script uses) into commands/init.md.');
    process.exit(1);
  }
} finally {
  fs.rmSync(scratchDir, { recursive: true, force: true });
}

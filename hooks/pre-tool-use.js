#!/usr/bin/env node
'use strict';

// gstack-pilot plugin - PreToolUse hook (BC-2026-08-31).
// The actual enforcement seam the sync-gate/collision-check design exists
// for: when the persisted mode is "execute", blocks any Write/Edit tool
// call unless .claude/hooks/state/preflight-ok exists, matches the current
// branch, and is fresh. This is what makes "stops Execute before any
// mutation, every time" true regardless of whether execute.md's prose was
// actually followed - a structural gate, not a claim resting on Claude
// reliably remembering to run scripts/pre-flight-sync.js first.
//
// Registered in hooks.json with matcher "Write|Edit" - this file still
// re-checks tool_name defensively rather than trusting the matcher alone,
// same defensive-in-depth posture as the rest of this plugin's hooks.
//
// CRITICAL: any marker read/parse failure (missing, corrupted, unreadable,
// wrong shape) is treated as "no marker" - fails CLOSED, never open. This
// is a hard requirement from the design doc's Failure Modes table, not an
// optional nicety: a hook that fails open on a corrupted marker has a
// silent bypass of the entire mechanism this file exists to build.

const fs = require('fs');
const path = require('path');

const MARKER_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours - matches scripts/pre-flight-sync.js's own TTL (see that file's decision-7 comment on why a TTL stands in for a true session-id match here).

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(projectDir, '.claude', 'hooks', 'state');
const modeFile = path.join(stateDir, 'mode.json');
const markerFile = path.join(stateDir, 'preflight-ok');

function allow() {
  // No output = no opinion = tool call proceeds. Safe default for every
  // path that isn't an active execute-mode block.
  process.exit(0);
}

function deny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0); // exit 0 with an explicit deny decision, not a crash
}

function readJsonStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function currentGitBranch() {
  try {
    const { execFileSync } = require('child_process');
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectDir,
      encoding: 'utf8'
    }).trim();
  } catch (err) {
    return null;
  }
}

function main() {
  const input = readJsonStdin();
  const toolName = input.tool_name || '';

  // Defensive re-check even though hooks.json's matcher already scopes this
  // to Write|Edit - never assume the matcher is the only thing standing
  // between an unrelated tool call and a spurious block.
  if (toolName !== 'Write' && toolName !== 'Edit') {
    allow();
    return;
  }

  let mode = 'advisor';
  try {
    const state = JSON.parse(fs.readFileSync(modeFile, 'utf8'));
    if (state.mode) mode = state.mode;
  } catch (err) {
    // No readable mode state - nothing to enforce (mirrors session-start.js's
    // own default-to-advisor fallback).
    allow();
    return;
  }

  if (mode !== 'execute') {
    allow();
    return;
  }

  // A write to mode.json itself is the hand-back/hand-off mechanism, not a
  // task mutation - always allow it regardless of marker/branch state. Without
  // this, an Execute task that merges its own branch and deletes it (the
  // trivial-housekeeping exemption's own direct-to-main path) leaves the
  // marker pointing at a now-gone branch, and the mode-switch write that's
  // supposed to get OUT of execute mode gets blocked by the very state it's
  // trying to leave - a real deadlock hit live, BC-077-T5-T7 (2026-09-02).
  const targetPath = input.tool_input && input.tool_input.file_path;
  if (targetPath && path.resolve(String(targetPath)) === modeFile) {
    allow();
    return;
  }

  let marker = null;
  try {
    const raw = fs.readFileSync(markerFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.branch === 'string' && typeof parsed.timestamp === 'string') {
      marker = parsed;
    }
    // Any other shape (missing fields, wrong types) falls through to
    // marker === null below - fails closed, not open.
  } catch (err) {
    // Missing file, unreadable, or unparseable JSON - fails closed.
    marker = null;
  }

  if (!marker) {
    deny(
      'gstack-pilot: no valid pre-flight marker found for this Execute task. Run `node scripts/pre-flight-sync.js` first, then retry.'
    );
    return;
  }

  const branch = currentGitBranch();
  if (!branch || marker.branch !== branch) {
    deny(
      'gstack-pilot: pre-flight marker is for branch "' + marker.branch + '" but the current branch is "' +
        (branch || 'unknown') + '". Run `node scripts/pre-flight-sync.js` again on this branch before continuing.'
    );
    return;
  }

  const markerTime = Date.parse(marker.timestamp);
  if (!Number.isFinite(markerTime) || Date.now() - markerTime > MARKER_TTL_MS) {
    deny(
      'gstack-pilot: pre-flight marker is stale (older than the freshness window). Run `node scripts/pre-flight-sync.js` again before continuing.'
    );
    return;
  }

  allow();
}

main();

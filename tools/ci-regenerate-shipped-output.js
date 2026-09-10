'use strict';

// TEMPORARY helper for PR #1218 only.
// Run the repository's canonical build inside GitHub Actions (where locked Babel deps are installed),
// commit only the generated shipped files, then this helper and the workflow edit are removed.
const { execFileSync } = require('child_process');
const path = require('path');
const { REPO_ROOT } = require('./harness');

const run = (cmd, args, options = {}) => execFileSync(cmd, args, {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  env: process.env,
  ...options,
});

if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_HEAD_REF) {
  console.error('NG: this temporary helper must run only in a pull-request GitHub Actions job');
  process.exit(1);
}

// Use the normal build entry point. This synchronizes parts -> game-system.jsx,
// stamps version/cache keys, compiles with the locked Babel toolchain, and refreshes boot sizes.
run(process.execPath, [path.join(REPO_ROOT, 'tools', 'build.js'), '--from-parts']);

run('git', ['config', 'user.name', 'github-actions[bot]']);
run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
run('git', ['add', 'monster-hero']);

try {
  execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: REPO_ROOT, stdio: 'ignore' });
  console.log('No generated changes to commit.');
  process.exit(0);
} catch (_) {
  // staged changes exist
}

run('git', ['status', '--short']);
run('git', ['commit', '-m', 'build: regenerate Undine motion output']);
run('git', ['push', 'origin', `HEAD:${process.env.GITHUB_HEAD_REF}`]);
console.log(`Pushed canonical generated output to ${process.env.GITHUB_HEAD_REF}`);

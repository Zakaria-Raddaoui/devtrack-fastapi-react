const { existsSync } = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const exePath = path.resolve(__dirname, '..', 'dist', 'DevTrack-win32-x64', 'DevTrack.exe');
const icoPath = path.resolve(__dirname, 'assets', 'favicon.ico');
const rceditPath = path.resolve(__dirname, '..', 'node_modules', 'rcedit', 'bin', 'rcedit.exe');

if (!existsSync(exePath)) {
  console.warn(`[patch-exe-icon] Skipping: exe not found at ${exePath}`);
  process.exit(0);
}
if (!existsSync(icoPath)) {
  console.warn(`[patch-exe-icon] Skipping: icon not found at ${icoPath}`);
  process.exit(0);
}
if (!existsSync(rceditPath)) {
  console.warn(`[patch-exe-icon] Skipping: rcedit not found at ${rceditPath}`);
  process.exit(0);
}

const result = spawnSync(rceditPath, [exePath, '--set-icon', icoPath], {
  stdio: 'inherit',
  windowsHide: true,
});

if (result.status !== 0) {
  console.error('[patch-exe-icon] Failed to patch exe icon.');
  process.exit(result.status || 1);
}

console.log('[patch-exe-icon] Icon patched successfully.');

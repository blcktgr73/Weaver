// Opens an Extension Development Host on a folder, with the extension loaded.
// Usage: node scripts/dev.js [folder]   (default: examples/sample-workspace)
//
// The extension path is made absolute here because a relative
// --extensionDevelopmentPath is resolved against the wrong directory on Windows.
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'apps', 'vscode-extension');
const folder = path.resolve(root, process.argv[2] || path.join('examples', 'sample-workspace'));

// An installed copy (palab.weaver) registers the same commands as this checkout, so the host
// would fail with "command ... already exists". Disable the installed copy in this window only.
// `code` is a .cmd shim on Windows, so it needs a shell; quote the paths ourselves.
const child = spawn(`code --new-window --disable-extension palab.weaver "--extensionDevelopmentPath=${extension}" "${folder}"`, {
  shell: true,
  detached: true,
  stdio: 'ignore',
});
child.unref();
console.log(`Opening ${folder} with the extension from ${extension}`);

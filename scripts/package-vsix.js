// Builds an installable VSIX from the bundled extension.
// Run through `npm run package` from the repository root.
//
// vsce rejects the scoped workspace name (@palab/weaver-vscode-extension), so the
// VSIX is staged with the extension name "weaver" (extension ID palab.weaver).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'apps', 'vscode-extension');
const stage = path.join(root, 'dist', 'vsix-stage');

const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'package.json'), 'utf8'));
for (const key of ['scripts', 'devDependencies', 'dependencies']) delete manifest[key];
manifest.name = 'weaver';

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, 'dist'), { recursive: true });
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2));
for (const file of ['README.md', 'package.nls.json', 'package.nls.ko.json']) {
  fs.copyFileSync(path.join(extension, file), path.join(stage, file));
}
fs.copyFileSync(path.join(extension, 'dist', 'extension.js'), path.join(stage, 'dist', 'extension.js'));

const output = path.join(root, 'dist', `weaver-${manifest.version}.vsix`);
const vsce = path.join(root, 'node_modules', '@vscode', 'vsce', 'vsce');
const result = spawnSync(
  process.execPath,
  [vsce, 'package', '--no-dependencies', '--skip-license', '--out', output],
  { cwd: stage, stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`\nVSIX: ${output}`);

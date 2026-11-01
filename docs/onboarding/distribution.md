# Distributing the Weaver extension

This page lists the ways to get the Weaver VS Code extension to other people, what each one needs, and which ones work today.

| Channel | Status | Needs |
|---|---|---|
| VSIX file | Works today | A built `.vsix` file |
| GitHub Release | Works from the first tag | A `v*` tag that matches the extension version |
| VS Code Marketplace | Planned | A publisher account and a token |
| Open VSX | Planned | Same as Marketplace, plus an Open VSX account |

Start with the VSIX file while the user base is small. Publish to a registry only after the first feedback has been handled.

## VSIX file (works today)

1. Build it from a checkout, or download the `weaver-vsix` artifact of a CI run on `main`:

   ```bash
   npm ci
   npm run package        # writes dist/weaver-<version>.vsix
   ```

2. Install it. The path is relative to the folder the command runs in, so run it from the repository root and include `dist/`:

   ```bash
   code --install-extension dist/weaver-0.1.1.vsix
   ```

   A path such as `weaver-0.1.1.vsix` without `dist/` fails with `ENOENT`. In the VS Code UI, use Extensions view → `…` → `Install from VSIX…` instead.

3. Check that the extension ID `palab.weaver` is listed, then run `Weaver: Open Requirement View` from the command palette.

Send the same file to anyone who should try it. They need VS Code 1.90 or later.

The repository is licensed under MIT (`LICENSE`), and the VSIX includes it.

## GitHub Release

Pushing a tag builds the VSIX and the `weaver` command-line tool in CI and attaches both to a GitHub Release (`.github/workflows/release.yml`). `weaver.js` is one file that runs with Node 20 or later (`node weaver.js --help`); the workflow runs it once before it is attached. The tool is not part of the VSIX. Releases are marked as pre-releases while the version is `0.0.x`.

1. Bump the version in `apps/vscode-extension/package.json` (and the lock file): `npm version <version> -w @palab/weaver-vscode-extension --no-git-tag-version`.
2. Merge the bump to `main`.
3. Tag and push. The tag must be `v` plus the extension version, or the workflow fails before building:

   ```bash
   git tag v0.0.3
   git push origin v0.0.3
   ```

4. Open the repository's Releases page, download `weaver-<version>.vsix`, and install it as described above.

The same workflow runs the checks and tests first, so a broken build never reaches a release.

## VS Code Marketplace (planned)

Needs, in order:

1. The LICENSE file (done, MIT); the VSIX already includes it.
2. A Marketplace publisher whose ID matches the `palab` part of `palab.weaver`, and a personal access token for it.
3. A version bump in `apps/vscode-extension/package.json` for every release. A registry refuses a version it has already seen.

Then publish with `@vscode/vsce` (already a dev dependency):

```bash
npx vsce publish --packagePath dist/weaver-<version>.vsix
```

Keep the token in a CI secret, never in the repository.

## Open VSX (planned)

Open VSX serves VS Code-compatible editors that cannot use the Marketplace. It needs its own account and token, and publishes the same VSIX:

```bash
npx ovsx publish dist/weaver-<version>.vsix -p <token>
```

## Release checklist

- The linked requirement and tasks are verified, and CI is green on `main`.
- The version in `apps/vscode-extension/package.json` is new.
- The VSIX was installed once in a normal VS Code window, not only in the development host.
- The getting-started guide still matches the shipped behavior.
- Known gaps are listed in the release notes.

## Related

- [Getting started](getting-started.md)
- `TASK-012`: packaging, the first build of this pipeline

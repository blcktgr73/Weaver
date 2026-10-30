# Distributing the Weaver extension

This page lists the ways to get the Weaver VS Code extension to other people, what each one needs, and which ones work today.

| Channel | Status | Needs |
|---|---|---|
| VSIX file | Works today | A built `.vsix` file |
| GitHub Release | Planned | A tag and a CI step that attaches the VSIX |
| VS Code Marketplace | Planned | A LICENSE file, a publisher account, a token |
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
   code --install-extension dist/weaver-0.0.1.vsix
   ```

   A path such as `weaver-0.0.1.vsix` without `dist/` fails with `ENOENT`. In the VS Code UI, use Extensions view → `…` → `Install from VSIX…` instead.

3. Check that the extension ID `palab.weaver` is listed, then run `Weaver: Open Requirement View` from the command palette.

Send the same file to anyone who should try it. They need VS Code 1.90 or later.

The VSIX is built with `--skip-license` because the repository has no LICENSE file yet. Choose a license before sharing the file outside the team.

## GitHub Release (planned)

Attach the VSIX to a tagged release so people can download it from the repository without building:

```bash
gh release create v0.0.1 dist/weaver-0.0.1.vsix --title "Weaver 0.0.1" --notes "First MVP build"
```

The planned CI step builds the VSIX on a `v*` tag and attaches it automatically. Until then, run the command above by hand after `npm run package`.

## VS Code Marketplace (planned)

Needs, in order:

1. A LICENSE file, so the package can drop `--skip-license`.
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

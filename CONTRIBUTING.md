# Contributing to Srcflow

Thanks for helping out! Bug reports, ideas and pull requests are all welcome.

## Setup

```bash
yarn install
yarn dev
```

Node.js 20.9 or later. The editor only runs under `next dev` — it rewrites the files in
`src/app`, so work on a branch and check `git diff` after trying an edit.

## Before opening a pull request

```bash
yarn lint
yarn typecheck
yarn build
```

CI runs the same three commands.

## Guidelines

- **Follow what's there.** Find the closest existing component or pattern and match it.
  Styling rules — type scale, radius, CSS Module tokens, motion — are in
  [DESIGN.md](DESIGN.md).
- **Never lose user code.** Anything that writes to a source file must check that the file
  still holds what the edit started from, and refuse otherwise (see `writeElementClass`
  and `writeElementText` in `src/lib/elementFs.ts`).
- **Every state change eases.** Toggles, show / hide and hover states animate; nothing snaps
  (DESIGN.md §13).
- **Translations.** Editor strings live in `src/i18n/editor/en.ts` and `th.ts` — add a new
  string to both.
- **Shortcuts.** If you add or change a key, update `src/components/editor/ShortcutHelp.tsx`
  and the table in the README.
- **Comments** explain *why*, not *what*. Leave them out when the code already says it.

## Reporting a bug

Include the steps, what you expected, what happened, and — if a file was written wrongly —
the relevant part of the file before and after.

# Contributing to gBeta

Thanks for your interest in gBeta. Contributions, bug reports, and feedback are
welcome — it is an early-stage project and real-world use is exactly what we need.

This document explains how to report problems, ask for help, and contribute code.
By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and giving feedback

- **From the app:** click the **📣 megaphone** in the header. It opens a prefilled
  GitHub issue with technical context already filled in (assembly, view, track
  types, browser) — never your data. This is the easiest way to report something.
- **On GitHub:** open an issue at
  <https://github.com/TeamMacLean/gbeta/issues>. Please include what you were
  trying to do, what happened, what you expected, and — if you can — a shareable
  view URL or the GQL command involved.

When reporting a bug, the following help a lot:

- The genome/assembly and the kind of data (format) you loaded.
- Steps to reproduce, and whether it happens with the built-in **example data**
  ("Load example data" in the sidebar).
- Any messages in the browser console (open your browser's developer tools).

## Asking for help / support

Open a GitHub issue and add the **question** label, or start a discussion if
Discussions are enabled. There is no separate support channel.

## Setting up a development environment

**Prerequisites:** Node.js 20+ and npm.

```bash
git clone https://github.com/TeamMacLean/gbeta.git
cd gbeta            # the directory may still be named "gbetter" locally
npm install
npm run dev         # http://localhost:5173
```

## Running the checks

All contributions should keep the following green:

```bash
npm run check       # TypeScript / svelte-check (0 errors expected)
npm run test:unit   # Vitest unit tests
npm run test:e2e    # Playwright end-to-end tests (installs browsers on first run)
```

The unit suite excludes a performance test that downloads a large remote BAM; run
the rest with `npx vitest run --exclude '**/real-bam-performance.test.ts'`.

## Submitting changes

1. **Open an issue first** for anything non-trivial, so we can agree on the
   approach before you invest time.
2. Create a branch from `main`.
3. Make your change with tests. We value tests that exercise real behaviour, not
   just that the UI renders (a passing UI test is not the same as a working
   feature). Where practical, add a failing test first, then make it pass.
4. Ensure `npm run check` and the test suites pass.
5. Keep the diff focused and the commit history readable; write code that matches
   the surrounding style.
6. Open a pull request describing the change and linking the issue. CI must pass
   before review.

## Conventions

- **Language:** TypeScript (strict).
- **Framework:** Svelte 5 + SvelteKit. Use the runes API — `$state`, `$derived`,
  `$props`, and event attributes like `onclick`/`oninput` (not the legacy
  `export let` / `on:click`).
- **Rendering:** tracks are drawn on Canvas; overlays use SVG.
- **Privacy:** never send user feature data off the machine. Language-model calls
  may include only the question and a summary of loaded tracks (names, types,
  field names).
- **Reproducibility:** user-facing actions should be expressible as GQL where it
  makes sense, so analyses stay recordable and re-runnable.

## Project layout

See the [README](README.md#development) for the directory structure and the
broader documentation set.

## Licensing

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](LICENSE).

# Next Session — GBetter

**Last session:** 27 (2026-06-10). Everything below is on `origin/main`, tree clean,
`npm run check` 0 errors, 435 unit tests pass.

## What shipped (session 27)
- Coverage quality-controls stabilized + improved (bin averaging, sparse-region notice).
- **Gene lookup + AI** end-to-end: `geneLookup.ts`, `geneQuery.ts`, `queryRouter.ts`,
  `GenePicker.svelte`, shared gene highlight, AI `REASON:` reasoning in history.
- AI provider model IDs fixed (were retired) + stored-ID forward-migration.
- **Engine convergence**: SearchBar + QueryConsole share one engine (`routeQuery` over
  `executeQueryWithTracks`) and one history (`useQueryHistory`). Console: gene names
  work, taller/resizable, History "Export .gql".

## Open follow-ups (pick up here)
1. **Retire `KNOWN_GENES`** — the hardcoded 10-gene map in `queryLanguage.ts` still backs
   legacy `search`/`find`; now redundant with real gene lookup. Route those through the
   resolver and delete the map.
2. **Command-keyword parser gap** — input starting with a GQL keyword (`show me…`,
   `go to…`, `find…`) short-circuits to the greedy parser before reaching the AI. The
   greedy `list/find/show` fallback in `parseQuery` (returns valid for almost anything)
   is the culprit. Tighten so genuine NL reaches the AI.
3. **Conversational AI panel (#2 from history discussion)** — fuller multi-turn AI with
   follow-ups; the lighter-touch inline + history-reasoning is the current state.
4. **Notebook / named analyses** — save a whole history as a named, re-runnable analysis
   (builds on the new `exportHistory` .gql script).
5. **Console parity nits** — search-bar inline note can show a stale gene after a console
   navigation (two separate inline surfaces); add the multi-match "change?" picker to the
   console if wanted.

## Verify-live recipe (used all session)
Dev server `npm run dev` (5173) + a Playwright driver via `node_modules/playwright`
(`import pkg from '.../playwright/index.js'; const {chromium}=pkg;`). Drive the real UI,
`page.evaluate(() => import('/src/lib/services/...'))` to call real modules against real
APIs. Selectors: search input placeholder "Search genes, coordinates, or use GQL...";
GQL box placeholder "SELECT GENES INTERSECT variants"; coord input `[data-testid="coordinate-input"]`.

## Test gotcha
`tests/unit/real-bam-performance.test.ts` fails offline (downloads a 673MB remote BAM) —
exclude with `npx vitest run --exclude '**/real-bam-performance.test.ts'`.

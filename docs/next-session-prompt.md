# Next Session — GBetter

**Last session:** 28 (2026-06-11) — adversarial "bomb testing" + hardening.
Everything is committed locally (8 fix batches); `npm run check` 0 errors, 472
unit tests pass, live smoke test clean (no JS errors). **Check whether the bomb-
test commits are pushed.**

## What happened (session 28)
A multi-agent find→verify workflow swept 8 surfaces and confirmed **46 real bugs**
(2 critical, 21 high, 15 medium, 8 low). Fixed in 8 themed batches, each with
regression tests:

1. Persistence — corrupted localStorage / malformed `?gql=` no longer crash
   (Array.isArray validation, safeSetItem, decode guard, null activeModels).
2. Track parsers — GFF3 no longer dies on one bad %-escape; bedGraph rejects
   non-integer coords; BED12 block-count validation; VCF empty-ALT + UCSC-only
   chr prefix.
3. GQL engine — `filter score>=100` keeps the operator; WHERE/WITHIN on
   unknown field/target now surface a note instead of silent-empty.
4. Viewport — NaN/Infinity guards (zoom/pan/setViewport), inverted-range
   normalization (highlights), `?loc=` validation + commas.
5-6. Gene lookup + coverage — multi-locus genes return all positions;
   isCoordinate validates start<end; max-pool coverage downsampling (peaks);
   strategy NaN guard.
7-8. Concurrency + AI — SearchBar request-sequence guard; TrackView stale-paint
   guard; parseAIResponse multi-REASON; capped AI track context.

New test files: persistence-robustness, parser-robustness, gql-robustness,
viewport-robustness, robustness-gene-coverage, ai-prompt (extended).

## Deliberately deferred (low value / non-bugs)
- LIMIT negative silently ignored; ORDER BY unknown field (JS sort is stable);
  formatCoordinate inverted display; pan past chromosome end; FILTER value with
  spaces; quote-strip balance; lowercase KNOWN_GENES match. None affect
  correctness materially.

## Open follow-ups (from before, still valid)
1. Retire the hardcoded `KNOWN_GENES` map (redundant with real gene lookup).
2. Command-keyword parser gap (`show me…`/`go to…` short-circuit before the AI).
3. Conversational AI panel; named "notebook" analyses (history `.gql` export exists).
4. Cross-assembly chromosome-name normalization at the track-validation layer
   (parsers intentionally keep raw names now; a bare "1" VCF on a non-UCSC
   assembly still won't auto-match — this is the right place to fix it).

## Recipes
- Verify live: `npm run dev` (5173) + a Playwright driver via
  `node_modules/playwright`. `page.evaluate(() => import('/src/lib/services/...'))`
  hits real modules/APIs.
- Tests: `npx vitest run --exclude '**/real-bam-performance.test.ts'` (that one
  needs network to a 673MB BAM).
- jsdom here has no real localStorage — see persistence-robustness.test.ts for the
  in-memory mock + `vi.mock('$app/environment', () => ({ browser: true }))`.

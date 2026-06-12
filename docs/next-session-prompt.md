# Next Session — gBeta

**Status at last close (Session 30, 2026-06-12):** milestone reached, possibly an
endpoint. Everything committed and pushed to `origin/main`; `npm run check` 0
errors, 519 unit tests pass; working tree clean; dev server stopped. Live at
**https://teammaclean.github.io/gbeta/** (repo: `github.com/TeamMacLean/gbeta`).

## What gBeta is now
A private, in-browser, AI-native genome browser used as a lightweight analysis
engine: gene lookup (MyGene/Ensembl), the full GQL (SELECT / WHERE / INTERSECT /
WITHIN / IN scopes / `count` / aggregation MIN-MAX-AVG-SUM-COUNT / coverage), a
conversational **Ask AI** panel returning clickable ranked results, re-runnable
notebook **Analyses**, and reproducible URLs / `.gql` export. Pilot-ready:
one-click example data, reactive assembly-mismatch flags, in-app feedback link,
and a one-page orientation (`docs/PILOT.md`). A JOSS-format paper exists
(`paper.md` + `paper.bib`, Figure 1 in `docs/figures/`).

## If picking back up — the real next step is *use*, not features
The project deliberately paused to go to the field. The highest-value work is
running the **lab/collaborator pilot** (give 2-3 people a real task on their own
data, watch, collect feedback via the megaphone) — then let the issues that come
back drive what's built next.

## Open threads / candidate work (nothing urgent)
- **JOSS gates** (see `docs/JOSS-CHECKLIST.md`): paperwork is done; the unmet
  bars are *scope / substantial effort* and *evidence of use / community* — earned
  by the pilot + time, not by edits. Before any submission: fill author/ORCID/
  funding in `paper.md`, verify `paper.bib` details/DOIs, set the CoC contact,
  archive a release (Zenodo) for a DOI.
- **GQL**: arbitrary `GROUP BY` (only scalar aggregates + implicit per-gene
  INTERSECT grouping exist); result-set export (CSV/BED); median/quantiles.
- **AI chat**: persist the thread; save an exchange as an Analysis.
- Optionally rename the local working directory `gbetter` -> `gbeta` (cosmetic).

## Recipes / gotchas
- Verify live: `npm run dev` (5173) + Playwright via `node_modules/playwright`.
  Drive the AI without a key by stubbing `**/v1/messages` and pre-seeding
  `localStorage['gbeta_ai_settings']`.
- **Probe pitfall**: importing a store separately inside `page.evaluate` can be a
  DIFFERENT instance than the running app — drive the real UI for viewport-
  dependent checks.
- Tests: `npx vitest run --exclude '**/real-bam-performance.test.ts'`.
- Key code: `isGeneTrack`/`isVariantTrack` + aggregate parse/exec in
  `queryLanguage.ts`; gene resolution in `queryRouter.ts`; assembly-mismatch in
  `services/assemblyMatch.ts`; storage migration in `services/storage.ts`.

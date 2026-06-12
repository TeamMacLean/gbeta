# JOSS readiness checklist

An honest tracker of where gBeta stands against the
[JOSS review criteria](https://joss.readthedocs.io/en/latest/review_criteria.html).
This is a dry run toward the standard — gBeta is **not** ready to submit yet.

## Paper

- [x] `paper.md` in the required format (Summary + Statement of need + metadata)
- [x] `paper.bib` with references — **details and DOIs need verification**
- [x] Statement of need places the software in the context of related work
- [ ] Author list, ORCIDs, affiliations and funding completed
- [x] A figure illustrating use (`docs/figures/figure1.png`)

## Software & repository

- [x] Open source under an OSI-approved licence (MIT — `LICENSE`)
- [x] Public version-controlled repository
- [x] Automated tests (Vitest unit + Playwright e2e) run in CI
- [x] Documentation: installation, example usage, and a feature/query reference
  (README, tutorials, GQL manual)
- [x] Community guidelines — contributing, reporting issues, seeking support
  (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, in-app feedback link)

## The real gates (not yet met)

- [ ] **Substantial scholarly effort / not a "minor utility."** Borderline and a
  matter for editor discretion; a very new, single-maintainer project is exactly
  what is scrutinised under JOSS's *scope* criterion.
- [ ] **Evidence of use / a research community.** gBeta has essentially no users,
  usage history, or external contributors yet. JOSS does not require citations,
  but reviewers look for a plausible user base and research applications; the
  field pilot now beginning is intended to build this.
- [ ] **Maturity.** Several capabilities are early-stage (see *Limitations* in the
  paper): no general `GROUP BY`, AI translation is imperfect and non-deterministic,
  custom-genome support is rough, performance on very large data uncharacterised.

## Before any submission

- Fill in authors/ORCIDs/affiliations/funding in `paper.md`.
- Verify every entry in `paper.bib` (authors, volumes, pages, DOIs).
- Set the contact address in `CODE_OF_CONDUCT.md`.
- Tag a release and archive it (e.g. Zenodo) for a citable DOI.

# Plan: Documentation & CI Fixes

**Created**: Session 20 (2026-01-22)
**Status**: Planning complete, ready for implementation

## Current State

### What We Have
- **README.md** - Exists but outdated (Jan 16)
- **Tutorials** - 5 tutorials exist (Jan 12), pre-theme changes
- **Internal docs** - Dev notes (DEBUG-*, PLAN-*, SESSION-*)
- **VISUAL-DESIGN.md** - Complete spec for visual system
- **CI workflows** - ci.yml and deploy.yml exist

### Issues Identified

**Documentation:**
1. README.md says BigWig/BAM are "Planned" - they're complete
2. README.md says "Dark mode interface" - now light theme is default
3. Tutorials reference "dark-themed interface" - outdated
4. No docs for new features: themes, URL tracks, BAM/CRAM rendering
5. File format table incomplete

**CI:**
1. 11 persona tests fail checking for UI text that doesn't exist
2. CI runs on every push and fails
3. Deploy workflow can't succeed if CI fails

**Deployment:**
1. GitHub Pages may be stale or broken
2. Live demo at teammaclean.github.io/gbetter may not reflect current state

---

## Session 21: Fix CI (Priority 1)

**Goal**: Get CI passing so deployment can work

### Tasks

1. **Fix or skip failing persona tests** (~30 min)
   - 11 tests check for UI text that doesn't exist:
     - "No tracks loaded"
     - "Drop files on canvas"
     - Various file format hints
   - Options:
     - A) Update tests to match current UI
     - B) Skip these tests temporarily
     - C) Add the expected UI text back
   - Recommendation: Option A - update tests to match reality

2. **Verify CI passes locally** (~10 min)
   ```bash
   # Simulate CI
   npm run test:unit -- --coverage
   npm run build
   npx playwright test --grep-invert "Visual Regression"
   ```

3. **Push and verify GitHub Actions** (~5 min)
   - Watch CI run complete successfully
   - Verify deploy workflow triggers

4. **Verify GitHub Pages deployment** (~5 min)
   - Check https://teammaclean.github.io/gbetter/ loads
   - Verify it reflects current build

---

## Session 22: Update README (Priority 2)

**Goal**: README accurately reflects current capabilities

### Tasks

1. **Update feature table**
   ```markdown
   | Format | Description | Status |
   |--------|-------------|--------|
   | BED | Interval features (BED3-BED12) | ✅ Supported |
   | GFF3 | Gene annotations | ✅ Supported |
   | bedGraph | Signal/coverage data | ✅ Supported |
   | VCF | Variant calls | ✅ Supported |
   | BigBed | Indexed BED (local + remote) | ✅ Supported |
   | BigWig | Indexed signal (local + remote) | ✅ Supported |
   | BAM | Alignments (local + remote) | ✅ Supported |
   | CRAM | Alignments with reference | ✅ Supported |
   ```

2. **Update description**
   - Change "Dark mode interface" to "Light/dark/high-contrast themes"
   - Add mention of accessibility (colorblind-safe palettes)

3. **Add new sections**
   - Theme system
   - Remote URL track loading
   - Reference sequence display

4. **Update Quick Start** to reflect current UI

5. **Add badges** if not already present
   - CI status
   - Deploy status

---

## Session 23: Update Tutorials (Priority 3)

**Goal**: Tutorials match current UI and features

### Tasks

1. **Audit existing tutorials**
   - `01-getting-started.md` - Check UI descriptions
   - `02-exploring-genes.md` - Check gene track info
   - `03-advanced-queries.md` - Verify GQL examples work
   - `04-non-model-genomes.md` - Check assembly selection
   - `05-reproducible-analysis.md` - Verify workflow

2. **Update for light theme default**
   - Remove "dark-themed interface" references
   - Update any screenshots (if we add them)

3. **Add new tutorial: Loading Remote Tracks**
   - URL input in sidebar
   - Supported formats (BigBed, BigWig, tabix, BAM)
   - Example URLs to try

4. **Add new tutorial: Reading Alignments**
   - Loading BAM/CRAM files
   - Understanding zoom levels (coverage → blocks → sequence)
   - Interpreting CIGAR operations

5. **Add new tutorial: Customizing Themes**
   - Light/dark/high-contrast
   - Color palettes (Set2, Dark2, Paired)
   - Accessibility features

---

## Session 24: Documentation Organization (Priority 4)

**Goal**: Clean, organized documentation structure

### Tasks

1. **Create docs/README.md** (documentation index)
   ```markdown
   # gBeta Documentation

   ## User Guides
   - [Getting Started](tutorials/01-getting-started.md)
   - [Exploring Genes](tutorials/02-exploring-genes.md)
   ...

   ## Reference
   - [GQL Manual](GQL-MANUAL.md)
   - [File Formats](FILE-FORMATS.md)
   - [Assembly List](ASSEMBLIES.md)

   ## Developer
   - [Visual Design](VISUAL-DESIGN.md)
   - [Architecture](ARCHITECTURE.md)
   ```

2. **Archive dev notes**
   - Move DEBUG-*, PLAN-*, SESSION-* to `docs/archive/`
   - Or delete if no longer needed

3. **Create missing reference docs**
   - `FILE-FORMATS.md` - Detailed format support
   - `ASSEMBLIES.md` - List of 27 assemblies with details
   - `KEYBOARD-SHORTCUTS.md` - All shortcuts

4. **Add inline help to app** (optional)
   - Help button in header
   - Links to documentation

---

## Verification Checklist

After completing all sessions:

- [ ] CI passes on GitHub Actions
- [ ] GitHub Pages deploys successfully
- [ ] Live demo loads and works
- [ ] README accurately describes features
- [ ] All tutorials work with current UI
- [ ] Documentation is organized and discoverable

---

## Time Estimates

| Session | Focus | Estimated Time |
|---------|-------|----------------|
| 21 | Fix CI | 45 min |
| 22 | Update README | 30 min |
| 23 | Update Tutorials | 1-2 hours |
| 24 | Doc Organization | 1 hour |

**Total**: ~3-4 hours across multiple sessions

---

## Notes

- Fixing CI (Session 21) should be done first - it's blocking deployment
- README update (Session 22) has highest user impact
- Tutorial updates (Session 23) can be done incrementally
- Doc organization (Session 24) is nice-to-have polish

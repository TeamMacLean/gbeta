# gBeta TODO - Road to v0.1.0

## Release Blockers (Must Have)

- [ ] **README with screenshots** - Current README is minimal
- [ ] **Demo data files** - Sample files for each supported format in test-data/

## High Priority (Should Have for v0.1.0)

### 1. Filter/Highlight Commands
- GQL already parses `FILTER` and `HIGHLIGHT` but returns TODO
- Need to wire to actual track rendering
- Visual highlight: glow/outline on matching features
- Filter: hide non-matching, or dim them
- **Files**: `queryLanguage.ts`, track renderers

### 2. Feature Tooltips
- Hover over features to see attributes
- Click for detail panel
- Essential for data exploration
- **Files**: `TrackView.svelte`, new `FeatureTooltip.svelte`

### 3. AI Conversation Follow-ups
- When AI asks "Do you mean in view or all data?"
- User can reply "in view" without full re-query
- Track last AI exchange in context
- **Files**: `services/ai/`, `QueryConsole.svelte`

## Medium Priority (Nice for v0.1.0)

### 4. Export Functionality
- PNG screenshot of current view
- SVG vector export
- Export selected features as BED/GFF3
- **Files**: New `services/export.ts`

### 5. More Gene Model Themes
- Classic IGV style (boxes, no effects)
- UCSC style (blue/thick-thin)
- Minimalist line-art
- **Files**: `trackTypes/geneModel.ts`

### 6. Keyboard Shortcuts
- Arrow keys for pan
- +/- for zoom
- G for go-to coordinate
- / for search focus
- **Files**: `TrackView.svelte` or global handler

## Post v0.1.0 (v0.2.0+)

### Binary Format Support
- [ ] **BigWig** - WASM-based parsing, common for signal tracks
- [ ] **BAM** - Indexed reads, streaming, pileup view
- [ ] **FASTA** - Sequence display at high zoom

### Advanced Features
- [ ] **Comparison views** - Side-by-side regions or query results
- [ ] **Split view** - Multiple synchronized viewports
- [ ] **Bookmarks** - Save locations with notes
- [ ] **Track groups** - Organize related tracks
- [ ] **Remote tracks** - Load from URLs (CORS permitting)

---

## Completed (Session 2)

- [x] AI integration (Claude/OpenAI, provider abstraction)
- [x] GQL query language (SELECT, INTERSECT, WITHIN, ORDER BY, LIMIT)
- [x] Query console with history, save/load, export/import
- [x] URL state persistence (`?chr=X&start=Y&end=Z`)
- [x] localStorage session restore
- [x] Assembly system (27+ genomes, inference, custom loading)
- [x] Gene model themes (dark/flat with peaked introns)
- [x] Chromosome validation warnings
- [x] Track-aware SELECT queries (FROM clause)

---

## Quick Wins (< 1 hour each)

1. Update README with feature list and screenshot
2. Add more sample data files
3. Add one more gene theme (classic IGV)
4. Keyboard shortcuts for pan/zoom

## Session 3 Suggested Focus

1. README + demo data (release prep)
2. Feature tooltips (essential UX)
3. Filter/Highlight commands (complete GQL)
4. Quick keyboard shortcuts

This would get gBeta to a solid v0.1.0 state.

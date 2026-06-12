# gBeta

A modern, lightweight, AI-native genome browser that runs entirely in your browser.

[![CI](https://github.com/TeamMacLean/gbetter/actions/workflows/ci.yml/badge.svg)](https://github.com/TeamMacLean/gbetter/actions/workflows/ci.yml)
[![Deploy](https://github.com/TeamMacLean/gbetter/actions/workflows/deploy.yml/badge.svg)](https://github.com/TeamMacLean/gbetter/actions/workflows/deploy.yml)

> **Try it now → https://teammaclean.github.io/gbetter/**
> No installation, no sign-up, no server. Open it and start exploring. Your data never leaves your machine.

---

## Table of Contents

- [What is gBeta?](#what-is-gbeta)
- [Five-minute Quick Start](#five-minute-quick-start)
- [The Interface](#the-interface)
- [Loading Data](#loading-data)
- [Navigating](#navigating)
- [Assemblies](#assemblies)
- [GQL — the gBeta Query Language](#gql--the-gbeta-query-language)
  - [Navigation commands](#navigation-commands)
  - [Selecting data: `SELECT`](#selecting-data-select)
  - [Filtering: `WHERE`](#filtering-where)
  - [Overlap: `INTERSECT` and `WITHIN`](#overlap-intersect-and-within)
  - [Scope: `IN`](#scope-in)
  - [Counting and aggregation](#counting-and-aggregation)
  - [Coverage queries](#coverage-queries)
  - [Sorting and limiting](#sorting-and-limiting)
  - [Filter, highlight, clear](#filter-highlight-clear)
  - [Operator reference](#operator-reference)
- [The AI Assistant](#the-ai-assistant)
- [Reproducible Analysis](#reproducible-analysis)
- [Reading Alignments (BAM/CRAM)](#reading-alignments-bamcram)
- [Themes & Accessibility](#themes--accessibility)
- [A Complete Worked Example](#a-complete-worked-example)
- [Tips & Gotchas](#tips--gotchas)
- [Privacy & Security](#privacy--security)
- [Install & Deploy](#install--deploy)
- [Development](#development)
- [Tutorials & Further Reading](#tutorials--further-reading)
- [License](#license)

---

## What is gBeta?

gBeta is a genome browser you open in a browser tab. There is nothing to install and no account to create. You load your own files (locally, so they never leave your computer) or point it at remote indexed tracks, and you explore them by panning, zooming, and — uniquely — **querying**.

Three things make it different:

1. **It's a query engine, not just a viewer.** Beyond pan-and-zoom, gBeta has a small, readable query language (GQL) for asking real questions of your data: *which genes here overlap variants? how many variants does each gene have? what's the average? show me the pathogenic ones inside TP53.*
2. **It's AI-native, but reproducible.** You can ask questions in plain English. The AI translates them into GQL — a concrete, editable, shareable command — so every answer is reproducible and auditable. The AI never sees your genomic data, only your question and a summary of what's loaded.
3. **It's private and shareable.** All parsing happens in your browser. The current view lives in the URL, so sharing a link shares exactly what you're looking at. Queries export to plain-text `.gql` scripts.

**Highlights**

- Sub-second load, 60 fps pan/zoom on a Canvas renderer
- Two dozen built-in assemblies across animals, plants, fungi, and microbes, with reference sequence
- Local **and** remote tracks: BED, GFF3, bedGraph, VCF, BigBed, BigWig, BAM, CRAM, and tabix-indexed gz
- Gene lookup by symbol against real databases (MyGene.info + Ensembl)
- A full query language with `SELECT`, `WHERE`, `INTERSECT`, `WITHIN`, scopes, sorting, counting, and aggregation
- A conversational AI panel that runs queries, asks clarifying questions, and gives you clickable results
- Saveable, re-runnable analysis "notebooks"
- Light / dark / high-contrast themes with colorblind-safe palettes

---

## Five-minute Quick Start

1. **Open** https://teammaclean.github.io/gbetter/. A gene/transcript track loads automatically for the default assembly (human GRCh38).
2. **Pick your genome** from the assembly dropdown (top-left), if it isn't human.
3. **Go somewhere.** Type into the search bar (top): a gene symbol like `TP53`, or coordinates like `chr17:7668421-7687490`, and press Enter.
4. **Load your data.** Drag a `.bed`, `.gff3`, `.vcf`, `.bam` (+`.bai`), `.bw`, or `.bb` file onto the window — or use the **File** tab in the left sidebar. For remote files, use the **URL** tab.
5. **Explore.** Scroll to zoom, drag to pan. Toggle tracks on/off in the sidebar.
6. **Ask a question.** Click **💬 Ask AI** (bottom-right). Type *"which genes here have variants?"* — or open the **GQL Console** (`Cmd+\`` / the tab at the bottom) and run GQL directly.
7. **Make it pretty / accessible.** The gear icon (top-right) → **Display** has themes and colorblind-safe palettes.

That's the whole loop: **load → navigate → query → share.** The rest of this guide goes deep on each step.

---

## The Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│  gBeta   [Assembly ▾] [chr ▾] [coordinates] [Go]   [ Search… ] ⚙️   │  ← Header
├───────────────┬─────────────────────────────────────────────────────┤
│  TRACKS       │                                                     │
│  ☑ Transcripts│                Track View (Canvas)                  │
│  ☑ my-genes   │         pan = drag · zoom = scroll wheel            │
│  ☑ variants   │                                                     │
│               │                                                     │
│  ADD TRACKS   │                                              💬 Ask │  ← AI panel
│  [File][URL]  │                                                  AI │
│  Drop or…     │                                                     │
├───────────────┴─────────────────────────────────────────────────────┤
│                    ⌄ GQL Console (Cmd+`)                            │  ← Console
└─────────────────────────────────────────────────────────────────────┘
```

- **Header** — the assembly selector, a chromosome dropdown, a coordinate box, and the **search bar** (gene / coordinates / commands / natural language). The gear opens **Settings**.
- **Sidebar** — your loaded **tracks** (toggle visibility, see colors), and the **Add Tracks** area with **File** and **URL** tabs. The "Drop or browse" zone accepts drag-and-drop.
- **Track View** — the Canvas where everything renders. **Drag** to pan, **scroll** to zoom. Features, genes, variants, signal, and alignments all draw here, adapting to zoom level and theme.
- **Ask AI** — a floating button (bottom-right) that opens a conversational panel. Multi-turn, asks for clarification when needed, and returns clickable results.
- **GQL Console** — a bottom panel (`Cmd+\``) for writing/translating queries, with **History**, **Saved**, and **Analyses** tabs.
- **Settings** (gear) — two tabs: **AI** (provider, API key, model, connection test) and **Display** (theme, palette, gene-model style).

---

## Loading Data

### Local files (private — never uploaded)

Drag files onto the window, or use **Add Tracks → File** in the sidebar. Parsing happens entirely in your browser; nothing is sent anywhere.

You can drop **multiple files at once**, including index files — gBeta auto-matches a data file to its index (e.g. `reads.bam` + `reads.bam.bai`). If an index is required but missing, you'll be prompted to pick it.

### Remote files (by URL)

Use **Add Tracks → URL** and paste a link to an indexed track. gBeta uses HTTP range requests, so it streams only the bytes it needs — you can browse a multi-gigabyte remote BAM without downloading it. The index must sit next to the data file (e.g. `…/file.bam` implies `…/file.bam.bai`). The host must allow CORS.

### Supported formats

| Format | Extension(s) | Index | Local | Remote | Notes |
|---|---|---|---|---|---|
| BED | `.bed` | — | ✅ | via `.gz`+`.tbi` | BED3–BED12, blocks/thick regions |
| GFF3 | `.gff3`, `.gff` | — | ✅ | via `.gz`+`.tbi` | gene→mRNA→exon/CDS hierarchies |
| bedGraph | `.bedgraph` | — | ✅ | — | signal / coverage, value-colored |
| VCF | `.vcf` | — | ✅ | via `.gz`+`.tbi` | variants; INFO fields are queryable |
| BigBed | `.bb` | self-indexed | ✅ | ✅ | HTTP range requests |
| BigWig | `.bw` | self-indexed | ✅ | ✅ | HTTP range requests |
| BAM | `.bam` | `.bai` | ✅ | ✅ | alignments; CIGAR-aware |
| CRAM | `.cram` | `.crai` | ✅ | ✅ | uses the assembly's 2bit reference |
| Tabix gz | `.vcf.gz`, `.gff.gz`, `.bed.gz` | `.tbi` | ✅ | ✅ | block-gzipped + tabix index |

### Chromosome names are normalized for you

Different files name chromosomes differently — `1`, `chr1`, `NC_000001.11`. When you load a track, gBeta normalizes its chromosome names to the **current assembly's** convention (so a BED that says `1` will render on human `chr1`). If a track's chromosomes genuinely don't match the assembly, you'll get a warning suggesting you switch assemblies or use "inferred from data."

---

## Navigating

### The search bar (header)

The fastest way around. It figures out what you typed:

| You type | gBeta does |
|---|---|
| `TP53` | resolves the gene symbol → navigates to it |
| `chr17:7,668,421-7,687,490` | jumps to those coordinates (commas OK) |
| `chr17:7668421-7687490` | same, no commas |
| `zoom in` / `zoom out` / `zoom 2x` | zooms |
| `pan left 10kb` / `pan right 5000` | pans |
| `go to BRCA1` | resolves and navigates |
| *anything in plain English* | sent to the AI (if configured) for translation |

It resolves deterministically first (coordinate? known gene? GQL command?) and only falls back to the AI for genuine free text — so everyday navigation is instant and needs no API key. As you type, it suggests gene names drawn from your **loaded** tracks.

### Mouse & keyboard

- **Drag** the track view to pan; **scroll** to zoom (down to single-base resolution).
- The **chromosome dropdown** and **coordinate box** in the header jump directly.
- **`Cmd+\``** toggles the GQL Console.

### Gene symbols and the picker

Gene names are resolved against real databases — **MyGene.info** (18 assemblies) and **Ensembl REST** (fungal/protist assemblies) — not a hardcoded list, so any gene works. If a symbol matches multiple loci, a **picker** lets you choose; the inline note shows which database answered and the coordinates.

---

## Assemblies

gBeta ships with **two dozen assemblies**, grouped taxonomically in the dropdown:

| Category | Examples |
|---|---|
| **Human** | GRCh38 (hg38), GRCh37 (hg19), T2T-CHM13 |
| **Mouse** | mm39, mm10 |
| **Model organisms** | Zebrafish (danRer11), Fly (dm6), Worm (ce11), Yeast (sacCer3) |
| **Plants** | Arabidopsis (TAIR10), Rice (IRGSP-1.0), Maize, Wheat, Barley |
| **Fungi** | S. pombe, Botrytis, Magnaporthe, Puccinia, Zymoseptoria |
| **Microbes** | E. coli K-12, SARS-CoV-2 |

Each has reference sequence (2bit) for nucleotide display at high zoom, and most have automatic gene/transcript tracks. If you load data from an assembly that isn't built in, gBeta can **infer the chromosomes from your data**.

---

## GQL — the gBeta Query Language

GQL is a small, readable, reproducible command language. You can type it in the **search bar** (single commands) or, for anything involving `SELECT`, in the **GQL Console** (`Cmd+\``). Natural-language questions get translated *into* GQL, so you always end up with a concrete command you can save and re-run.

GQL is **case-insensitive** for keywords. Coordinates are displayed 1-based (genomics convention).

### Navigation commands

```text
navigate chr17:7668421-7687490     # jump to coordinates
go to TP53                         # resolve a gene and navigate
zoom in                            # zoom in 2×
zoom out                           # zoom out 2×
zoom 2x                            # zoom by an explicit factor
pan left 10kb                      # move left 10,000 bp  (units: bp, kb, mb)
pan right 5000                     # move right 5,000 bp
highlight chr17:7670000-7675000    # draw a highlight box
highlight TP53                     # highlight a gene's span
clear highlights                   # remove highlights
clear filters                      # remove filters
clear all                          # remove both
```

### Selecting data: `SELECT`

`SELECT` pulls rows from your **loaded tracks** and shows them as a clickable result list (click any row to navigate to it).

```text
SELECT GENES                       # all genes from loaded gene tracks
SELECT VARIANTS                    # all variants from loaded VCF tracks
SELECT FEATURES                    # generic features (BED, etc.)
SELECT GENES FROM my-genes         # restrict to a named track
SELECT VARIANTS FROM cancer-variants
```

Track names can be quoted or unquoted (`FROM "cancer-variants"` works too), and you can refer to a track loosely — `variants` matches your VCF track, `genes` matches your gene track.

### Filtering: `WHERE`

Filter rows by a field. For variants, **all VCF INFO fields are available** (lowercased), plus `ref`/`alt`. For genes, `name`/`strand`/`length`/`start`/`end`.

```text
SELECT VARIANTS WHERE clin = pathogenic
SELECT VARIANTS WHERE clin CONTAINS pathogenic      # also matches likely_pathogenic
SELECT VARIANTS WHERE impact = nonsense
SELECT GENES WHERE strand = +
SELECT FEATURES WHERE score >= 100
```

The Console (and AI) know which fields each loaded track actually has, so they suggest the right ones. If you filter on a field no row has, gBeta tells you instead of silently returning nothing.

### Overlap: `INTERSECT` and `WITHIN`

```text
SELECT GENES INTERSECT variants        # genes that overlap any variant
SELECT VARIANTS WITHIN TP53            # variants inside a gene (resolved) or region
SELECT VARIANTS WITHIN chr17:7,668,421-7,687,490
SELECT GENES INTERSECT cancer-variants WHERE count >= 3
```

After an `INTERSECT`, **each gene gains a `count` field** — the number of overlapping features — which you can filter and aggregate (see below). Results are shown ranked by count, with a badge, so "which gene has the most variants" is answered at a glance.

### Scope: `IN`

By default a query runs over **all loaded data**. Narrow it with `IN`:

```text
SELECT GENES IN VIEW                   # only what's currently on screen
SELECT VARIANTS IN CHROMOSOME          # the whole current chromosome
SELECT GENES IN chr17                  # a named chromosome
SELECT VARIANTS IN chr17:1-1000000     # an explicit region
```

In plain English: "here" / "in view" → `IN VIEW`; "on this chromosome" → `IN CHROMOSOME`; "everywhere" / "all data" → no `IN` clause. (The AI will ask you to clarify scope when it's ambiguous, rather than guess.)

### Counting and aggregation

Count rows with the `COUNT` command:

```text
COUNT VARIANTS                         # total variants loaded
COUNT VARIANTS WITHIN TP53
COUNT GENES INTERSECT variants IN chr17
```

Or compute a **single aggregate value** over a result set by wrapping a numeric field in a function right after `SELECT`:

```text
SELECT MIN(count) GENES INTERSECT variants    # fewest variants in any gene
SELECT MAX(count) GENES INTERSECT variants    # most variants in any gene
SELECT AVG(count) GENES INTERSECT variants    # mean variants per gene
SELECT SUM(count) GENES INTERSECT variants    # total
SELECT COUNT(qual) VARIANTS                    # how many have a qual value
```

Functions: **MIN, MAX, AVG** (= MEAN), **SUM, COUNT**. `MIN`/`MAX` also report *which* rows hit the extreme — and those stay clickable, so the answer is one click from the view. (There's no `GROUP BY`, but `INTERSECT` already groups variants per gene, which covers the common case.)

### Coverage queries

For alignment depth, query BAM/CRAM tracks directly:

```text
SELECT REGIONS WHERE coverage >= 10
SELECT REGIONS WHERE coverage >= 15 IN chr1:1,000-2,000
```

This streams data through the BAM index and computes coverage only for the queried region, so it scales to large files. In plain English: *"find high coverage regions"*, *"show areas with coverage above 20"*.

### Sorting and limiting

```text
SELECT GENES INTERSECT variants ORDER BY count DESC LIMIT 10
SELECT GENES ORDER BY length DESC LIMIT 5
SELECT VARIANTS WHERE clin CONTAINS pathogenic ORDER BY start ASC
```

`ORDER BY <field> ASC|DESC`, then `LIMIT <n>`.

### Filter, highlight, clear

These act on the **view** rather than returning a list:

```text
filter type=exon strand=+              # dim/hide features that don't match
highlight chr17:7670000-7675000        # box a region
clear filters | clear highlights | clear all
```

### Operator reference

| Operator | Meaning | Example |
|---|---|---|
| `=` | equals | `WHERE clin = pathogenic` |
| `!=` | not equal | `WHERE impact != benign` |
| `>` `>=` `<` `<=` | numeric compare | `WHERE count >= 3`, `WHERE score < 50` |
| `CONTAINS` | substring | `WHERE clin CONTAINS pathogenic` |
| `MATCHES` | regex | `WHERE name MATCHES ^BRCA` |
| `AND` | combine conditions | `WHERE impact = nonsense AND clin = pathogenic` |

---

## The AI Assistant

gBeta has two ways to use natural language. Both translate your words into GQL — a concrete, editable command — so the answer is always reproducible.

### Ask AI (the conversational panel)

Click **💬 Ask AI** (bottom-right). This is a full chat:

- Ask in plain English: *"take me to the breast cancer gene"*, *"which genes here have variants?"*, *"show pathogenic variants in TP53"*, *"what's the fewest variants in any gene?"*
- It **runs the query for you** and shows the resulting genes/variants as a **ranked, clickable list** — click any row to jump there.
- When your request is ambiguous (e.g. scope unclear), it **asks a follow-up question** instead of guessing, and remembers the conversation — so you can answer *"in the current view"* and it picks up where it left off.
- For "which/most/fewest/average" it returns a real `SELECT`/aggregate and shows you the ranking, rather than guessing a single answer.

### The Console (natural language → editable GQL)

In the GQL Console, type a natural-language request and it produces the **GQL**, which you can review and edit before pressing **Execute**. This two-step flow is ideal when you want the reproducible command, not just the answer.

### Providers & setup

Open **Settings → AI**. Choose a backend, paste a key (if needed), pick a model, and **Test Connection**.

| Provider | Privacy | Cost |
|---|---|---|
| **Ollama** (local) | Complete — runs on your machine | Free |
| **Anthropic** (Claude) | Query text + track summary sent to API | Pay-per-use |
| **OpenAI** (GPT) | Query text + track summary sent to API | Pay-per-use |

**Your genomic data is never sent anywhere.** The AI receives only your question, the current coordinates, and a short summary of loaded tracks (names, types, and available field names) — never feature data. For complete privacy, run a local model with Ollama. See the [AI Setup Guide](docs/AI-SETUP.md).

Without any AI configured, everything deterministic still works: coordinates, gene lookup, and hand-written GQL.

---

## Reproducible Analysis

Reproducibility is a first-class feature, not an afterthought.

### Shareable URLs

The current chromosome and coordinates live in the URL. **Copy the link and you've shared exactly what you're looking at.** A query can also be encoded into a URL to share a specific command.

### `.gql` scripts

From the Console's **History** tab, **Export .gql** writes your session as a chronological, re-runnable script — each step annotated with the natural-language input and the AI's reasoning, as comments. From the **Saved** tab you can **Export**/**Import** saved queries. These are plain text: diff them, commit them, paste them into a methods section.

### Notebooks (the Analyses tab)

Turn a sequence of queries into a named, re-runnable **analysis**:

1. Run a few queries (in the Console or via Ask AI — they all land in **History**).
2. On the **History** tab, click **Save analysis** and name it.
3. Switch to the **Analyses** tab. Press **Run** to replay the whole sequence in order, any time — on the same or different data.

Saved queries, analyses, theme, and AI settings persist locally in your browser (and survive upgrades).

---

## Reading Alignments (BAM/CRAM)

BAM/CRAM tracks render at three zoom levels, switching automatically:

- **Zoomed out → coverage histogram.** A depth profile across the region. Peaks are preserved via max-pooling, so a tall narrow pileup isn't lost between pixels. Tune detail with the **Coverage Quality** control in the sidebar (Fast / Medium / Detailed).
- **Mid zoom → read blocks.** Individual reads with CIGAR operations: matches, insertions (I), deletions (D), soft-clips (S), and skips/introns (N) shown with visual indicators. Mapping quality drives opacity.
- **High zoom → nucleotides.** Per-base view with mismatches highlighted against the reference. CRAM uses the assembly's 2bit reference to reconstruct sequence.

Combine with coverage queries (`SELECT REGIONS WHERE coverage >= N`) to jump straight to deep or shallow regions.

---

## Themes & Accessibility

Accessibility is the default, not a mode. **Settings → Display:**

- **Themes** — Light (default, print-ready), Dark, High-Contrast.
- **Palettes** — Set2, Dark2, Paired — all ColorBrewer, all colorblind-safe.
- **Accessible nucleotide colors** — A = blue, C = orange, G = purple, T = teal.
- **Geometric strand cues** — chevrons indicate direction, so strand never depends on color alone.
- **Signal color ramps** — sequential light→dark ramps encode value.

Theme and palette persist across sessions, and the Canvas re-renders to match.

---

## A Complete Worked Example

This walkthrough uses the sample files in [`test-data/`](test-data/) (`human-genes-complex.gff3` and `cancer-variants.vcf`), which annotate five cancer genes (TP53, BRCA1, EGFR, KRAS, PTEN) and variants on them.

1. **Set the assembly** to human **GRCh38**.
2. **Load** `test-data/human-genes-complex.gff3` and `test-data/cancer-variants.vcf` (drag both onto the window).
3. **Go to a gene:** type `TP53` in the search bar.
4. Open the **GQL Console** (`Cmd+\``) and try:

```text
SELECT GENES IN VIEW
        → the genes/transcripts visible around TP53 (click one to jump to it)

SELECT GENES INTERSECT cancer-variants
        → the genes (and their transcripts), ranked by variant count:
          TP53 highest (4), then BRCA1 / EGFR (3), then KRAS / PTEN (2)

SELECT VARIANTS WHERE clin CONTAINS pathogenic
        → the pathogenic variants across the data

SELECT VARIANTS WITHIN TP53
        → just TP53's variants (clickable)

SELECT GENES INTERSECT cancer-variants WHERE count >= 3
        → the genes with 3+ variants (TP53, BRCA1, EGFR)

SELECT MIN(count) GENES INTERSECT cancer-variants
        → "MIN(count) = 2 — KRAS, PTEN"  (both clickable)

SELECT MAX(count) GENES INTERSECT cancer-variants
        → "MAX(count) = 4 — TP53"
```

5. Now do it conversationally: open **💬 Ask AI** and type *"which gene has the most variants?"* It returns the ranked list; click the top hit to land on it. Then ask a follow-up: *"just the pathogenic ones in that gene."*
6. **Save it:** every query is in **History** → **Save analysis** → name it "Cancer gene variant survey." Re-run it any time from the **Analyses** tab, or **Export .gql** to keep the script.

---

## Tips & Gotchas

- **No API key?** No problem. Coordinates, gene lookup, and all hand-written GQL work without AI. Only free-text natural language needs a provider.
- **`IN VIEW` means literally on screen.** If a query returns nothing, check your zoom — or drop the `IN` clause to search all loaded data.
- **Track names are flexible.** `variants` finds your VCF, `genes` finds your gene track; quotes are optional.
- **`count` only exists after `INTERSECT`.** `SELECT MIN(count) GENES` alone will tell you the field is missing and hint to add an `INTERSECT`.
- **Gene with several loci?** Use the picker that appears, or be explicit with coordinates.
- **Big remote BAM?** Loading by URL streams only what's needed — you don't have to download the whole file. The host must allow CORS.
- **Chromosome naming mismatch warning?** Your file's chromosomes don't match the chosen assembly. Switch assemblies or rely on inference.

---

## Privacy & Security

**Your genomic data never leaves your browser** unless you explicitly use a cloud AI provider — and even then, only your *query text* and a track *summary* are sent, never feature data.

- All file parsing is client-side JavaScript.
- No server, no database, no analytics, no tracking.
- Cloud AI sends only your question + loaded-track metadata (names/types/fields).
- Optional local LLM (Ollama) for end-to-end privacy.
- Clear indication when an action would contact an external service.

---

## Install & Deploy

### Use the hosted version (recommended)

Just visit **https://teammaclean.github.io/gbetter/**. Nothing to install; data stays local.

### Deploy your own instance (GitHub Pages)

1. **Fork** https://github.com/TeamMacLean/gbetter
2. In your fork, **Settings → Pages → Source: GitHub Actions**, and Save.
3. The deploy workflow runs automatically; your instance goes live at `https://YOUR-USERNAME.github.io/gbetter/`.
4. Keep it updated by syncing your fork:
   ```bash
   git fetch upstream
   git merge upstream/main
   git push
   ```

### Run locally

```bash
git clone https://github.com/TeamMacLean/gbetter.git
cd gbetter
npm install
npm run dev          # http://localhost:5173
```

### Self-host (static)

```bash
npm run build        # output in build/
# deploy build/ to nginx, Apache, S3, Netlify, Cloudflare Pages, …
```

If you don't host at the domain root, set the base path in `svelte.config.js`.

---

## Development

**Prerequisites:** Node.js 20+, npm.

```bash
npm run dev          # dev server (localhost:5173)
npm run build        # production build
npm run check        # TypeScript / svelte-check
npm run test:unit    # Vitest unit tests (500+)
npm run test:e2e     # Playwright end-to-end tests
```

**Project layout**

```
src/
  lib/
    components/   # Svelte 5 UI (Header, Sidebar, TrackView, QueryConsole, AIChat, …)
    stores/       # state via runes (viewport, tracks, theme, assembly, …)
    services/     # parsers, GQL engine, gene lookup, AI providers, persistence
    types/        # TypeScript definitions
  routes/         # SvelteKit pages
tests/
  unit/           # Vitest
  e2e/            # Playwright
test-data/        # sample genomic files (used by the worked example above)
docs/             # specifications, manuals, tutorials
```

Built with **Svelte 5 + SvelteKit**, **TypeScript** (strict), **Canvas** for tracks, **Tailwind** for UI, and **Vite**.

---

## Tutorials & Further Reading

Step-by-step guides in [`docs/`](docs/):

1. [Getting Started](docs/tutorials/01-getting-started.md) — interface basics, loading files, navigation
2. [Exploring Genes](docs/tutorials/02-exploring-genes.md) — gene tracks, VCF analysis, queries
3. [Advanced Queries](docs/tutorials/03-advanced-queries.md) — complex GQL, multi-track analysis
4. [Non-Model Genomes](docs/tutorials/04-non-model-genomes.md) — assemblies and custom genomes
5. [Reproducible Analysis](docs/tutorials/05-reproducible-analysis.md) — URLs, scripts, notebooks
6. [Remote Tracks](docs/tutorials/06-remote-tracks.md) — BigWig/BAM URLs, tabix, CORS
7. [Reading Alignments](docs/tutorials/07-reading-alignments.md) — BAM/CRAM, CIGAR
8. [Customizing Themes](docs/tutorials/08-customizing-themes.md) — themes, palettes, accessibility

**Reference:**

- [Pilot: Try This](docs/PILOT.md) — a one-page orientation for new users / pilot testers
- [GQL Manual](docs/GQL-MANUAL.md) — the complete query-language reference
- [GQL Examples](docs/GQL-EXAMPLES.md) — practical query recipes
- [AI Setup Guide](docs/AI-SETUP.md) — configure Ollama / Anthropic / OpenAI
- [Loading Remote Tracks](docs/URL-TRACKS.md) — URLs, indexes, and CORS in depth
- [Gene Naming Conventions](docs/GENE-NAMING.md) — how gene IDs are extracted and displayed
- [Gene Track Hosting](docs/GENE-TRACKS.md) — how built-in gene tracks load, and adding new genomes

---

## License

MIT.

Built with Svelte, TypeScript, and Canvas. Powered by curiosity.

# GQL Manual - gBeta Query Language

GQL (gBeta Query Language) is a simple, reproducible query language for genome browser operations. GQL commands can be entered in two places:

- **Search Bar** (header) - Quick commands with basic pattern matching
- **GQL Console** (bottom panel, `Cmd+\``) - Full GQL support with AI-powered natural language translation, editable queries, history, and saved queries

When you type natural language, gBeta translates it to GQL, ensuring your queries are always reproducible and shareable. The GQL Console shows you the translated query before execution, so you can review and modify it.

## Table of Contents

- [Navigation Commands](#navigation-commands)
- [Search Commands](#search-commands)
- [Zoom Commands](#zoom-commands)
- [Pan Commands](#pan-commands)
- [Filter Commands](#filter-commands)
- [Highlight Commands](#highlight-commands)
- [Clear Commands](#clear-commands)
- [List Commands](#list-commands)
- [SELECT Queries](#select-queries) (incl. INTERSECT/WITHIN, WHERE, [Aggregates](#aggregates))
- [COUNT Queries](#count-queries)
- [Coverage Queries](#coverage-queries)
- [Coordinate Formats](#coordinate-formats)
- [Natural Language Translation](#natural-language-translation)

---

## Navigation Commands

Navigate directly to genomic coordinates.

### Syntax

```
navigate <coordinates>
goto <coordinates>
go <coordinates>
```

### Parameters

| Parameter | Description | Format |
|-----------|-------------|--------|
| coordinates | Genomic location | `chr:start-end` |

### Examples

```
navigate chr17:7668421-7687490
goto chr1:1000000-2000000
go chrX:15000000-16000000
```

### Notes

- Coordinates are 1-based (genomics convention)
- Chromosome names are case-insensitive (`chr17` = `Chr17` = `CHR17`)
- Commas in numbers are stripped (`chr1:1,000,000-2,000,000` works)

---

## Search Commands

Search for and navigate to named features (genes).

### Syntax

```
search gene <name>
search <name>
```

### Parameters

| Parameter | Description | Examples |
|-----------|-------------|----------|
| name | Gene name or symbol | TP53, BRCA1, EGFR |

### Examples

```
search gene TP53
search BRCA1
search gene MYC
```

### Gene Resolution

Gene symbols are resolved to coordinates against **live databases** —
[MyGene.info](https://mygene.info) (18 assemblies) and Ensembl REST (fungal/
protist assemblies) — so **any** valid gene symbol works, not a fixed list. The
result is cached for the session.

- Resolution happens for `NAVIGATE`/`go to`, a bare gene symbol in the search
  bar, `SEARCH gene <symbol>`, `SELECT … WITHIN <gene>`, and `FIND variants in <gene>`.
- If a track you've loaded already contains the gene, its coordinates are used
  first; otherwise the lookup API is queried.
- If a symbol matches multiple loci, a picker lets you choose.

---

## Zoom Commands

Adjust the viewport zoom level.

### Syntax

```
zoom in
zoom out
zoom <factor>
zoom <factor>x
```

### Parameters

| Parameter | Description | Effect |
|-----------|-------------|--------|
| in | Zoom in | Shows 50% of current range |
| out | Zoom out | Shows 200% of current range |
| factor | Numeric multiplier | `2` = zoom out 2x, `0.5` = zoom in 2x |

### Examples

```
zoom in          # Zoom in 2x
zoom out         # Zoom out 2x
zoom 4x          # Zoom out 4x (show 4x more bases)
zoom 0.25x       # Zoom in 4x (show 25% of current range)
```

---

## Pan Commands

Move the viewport left or right.

### Syntax

```
pan <direction> [amount]
```

### Parameters

| Parameter | Description | Values |
|-----------|-------------|--------|
| direction | Movement direction | `left`, `right`, `l`, `r` |
| amount | Distance to move | Number with optional unit |

### Units

| Unit | Multiplier | Example |
|------|------------|---------|
| bp (default) | 1 | `1000` = 1000 bp |
| kb | 1,000 | `10kb` = 10,000 bp |
| mb | 1,000,000 | `1mb` = 1,000,000 bp |

### Examples

```
pan left 10000      # Move left 10,000 bp
pan right 50kb      # Move right 50 kb
pan l 1mb           # Move left 1 megabase
pan r               # Move right 10 kb (default)
```

---

## Filter Commands

Filter features by attributes. Non-matching features are dimmed (shown at 25% opacity).

### Syntax

```
filter <field>=<value> [<field>=<value> ...]
```

### Common Fields

| Field | Description | Example Values |
|-------|-------------|----------------|
| type | Feature type | exon, CDS, gene, mRNA, UTR |
| strand | DNA strand | +, - |
| name | Feature name | Gene name, transcript ID |

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| = | Equals | `type=exon` |
| != | Not equals | `type!=intron` |
| > | Greater than | `score>100` |
| < | Less than | `score<50` |
| >= | Greater or equal | `score>=75` |
| <= | Less or equal | `length<=1000` |
| ~ | Matches regex | `name~BRCA*` |
| * | Contains | `name*kinase` |

### Examples

```
filter type=exon                    # Show only exons
filter type=CDS                     # Show only coding sequences
filter strand=+                     # Show plus strand features
filter strand=-                     # Show minus strand features
filter type=exon strand=+           # Combine filters (AND)
filter score>100                    # Features with score > 100
```

### Notes

- Filtering is case-insensitive (`type=exon` matches `Exon`, `EXON`)
- Multiple filters use AND logic
- Use `clear filters` to remove all filters

---

## Highlight Commands

Add a visual highlight to a genomic region.

### Syntax

```
highlight <coordinates>
```

### Parameters

| Parameter | Description | Format |
|-----------|-------------|--------|
| coordinates | Region to highlight | `chr:start-end` |

### Examples

```
highlight chr17:7670000-7675000
highlight chr1:1000000-1500000
```

### Notes

- Highlights are drawn as semi-transparent overlays
- Multiple highlights can be active simultaneously
- Highlighting a region also navigates to show it
- Use `clear highlights` to remove all highlights

---

## Clear Commands

Remove active filters and/or highlights.

### Syntax

```
clear [target]
```

### Targets

| Target | Description |
|--------|-------------|
| filters | Remove all active filters |
| highlights | Remove all highlights |
| all | Remove both filters and highlights |
| (none) | Same as `all` |

### Examples

```
clear filters       # Remove filters only
clear highlights    # Remove highlights only
clear all           # Remove everything
clear               # Remove everything
```

---

## List Commands

Query loaded data and display results.

### Syntax

```
list <what> [modifiers]
find <what> [modifiers]
show <what> [modifiers]
```

### What to List

| What | Description |
|------|-------------|
| genes | All genes (from loaded tracks or built-in index) |
| variants | All variants from loaded VCF tracks |
| genes with variants | Genes overlapping variant positions |
| variants in GENE | Variants within a specific gene |
| pathogenic variants | Variants marked as pathogenic |

### Examples

```
list genes                    # All known genes
list variants                 # All loaded variants
list genes with variants      # Genes containing variants
list variants in TP53         # Variants within TP53
list pathogenic variants      # Clinically significant variants
find genes                    # Same as list
show variants                 # Same as list
```

---

## SELECT Queries

SQL-like queries for complex data analysis.

### Syntax

```
SELECT <what> [FROM <track>] [INTERSECT <track>] [WITHIN <region>] [WHERE <conditions>] [IN <scope>] [ORDER BY <field> [ASC|DESC]] [LIMIT <n>]
```

### What to Select

| What | Description |
|------|-------------|
| GENES | Gene features |
| VARIANTS | Variant features |
| FEATURES | All features |
| * or ALL | Everything |

### Clauses

#### FROM

Specify a source track by name.

```
SELECT GENES FROM my-annotations
SELECT VARIANTS FROM sample.vcf
```

#### INTERSECT

Find features overlapping another track. After an `INTERSECT`, **each result
gains a numeric `count` field** — the number of overlapping features — which you
can filter (`WHERE count …`) and aggregate (see [Aggregates](#aggregates)).
Results are shown ranked by `count`.

```
SELECT GENES INTERSECT variants                      # genes that overlap a variant
SELECT GENES INTERSECT variants WHERE count >= 3     # genes with 3+ variants
SELECT GENES INTERSECT variants WHERE count = 1      # genes with exactly one
SELECT FEATURES FROM peaks INTERSECT promoters
```

The intersect target can be a track name (quoted or not) or a loose type word —
`variants` matches your VCF track, `genes` matches your gene track.

#### WITHIN

Find features within a gene or region.

```
SELECT VARIANTS WITHIN TP53
SELECT FEATURES WITHIN chr17:7000000-8000000
```

#### WHERE

Filter by field values. For variants, **all VCF INFO fields are available**
(lowercased) plus `ref`/`alt`; for genes, `name`/`strand`/`length`/`start`/`end`;
after `INTERSECT`, the `count` field. The Console and AI know which fields each
loaded track actually has and suggest them.

```
SELECT VARIANTS WHERE clin = pathogenic
SELECT VARIANTS WHERE clin CONTAINS pathogenic      # also matches likely_pathogenic
SELECT VARIANTS WHERE impact = nonsense
SELECT GENES WHERE strand = + AND length > 10000
SELECT GENES INTERSECT variants WHERE count >= 3
```

Supported operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `CONTAINS`, `MATCHES`, joined with `AND`.
If you filter on a field no result has, gBeta tells you rather than silently returning nothing.

#### IN

Limit scope to a region.

```
SELECT GENES IN VIEW                    # Current viewport
SELECT VARIANTS IN CHROMOSOME           # Current chromosome
SELECT FEATURES IN chr17                # Specific chromosome
SELECT GENES IN chr17:7000000-8000000   # Specific region
```

#### ORDER BY

Sort results.

```
SELECT GENES ORDER BY name ASC
SELECT GENES ORDER BY length DESC
SELECT GENES ORDER BY (end - start) DESC    # Same as length
```

#### LIMIT

Restrict number of results.

```
SELECT GENES LIMIT 10
SELECT GENES ORDER BY length DESC LIMIT 5
```

### Aggregates

Wrap a numeric field in an aggregate function **right after `SELECT`** to compute
a single value over the result set. Functions: `MIN`, `MAX`, `AVG` (= `MEAN`),
`SUM`, `COUNT`.

```
SELECT MIN(count) GENES INTERSECT variants    # fewest variants in any gene
SELECT MAX(count) GENES INTERSECT variants    # most variants in any gene
SELECT AVG(count) GENES INTERSECT variants    # mean variants per gene
SELECT SUM(count) GENES INTERSECT variants    # total
SELECT COUNT(qual) VARIANTS                    # how many have a qual value
```

The field must be numeric (e.g. `count` after `INTERSECT`, or `qual`/`score`/
`length`). `MIN`/`MAX` also report **which** rows hit the extreme, and those stay
clickable. There is no `GROUP BY`, but `INTERSECT` already groups overlapping
features per result — so "min/max/average variants per gene" is an aggregate over
`SELECT GENES INTERSECT <variants>`.

### Complete Examples

```
# Top 10 longest genes in view
SELECT GENES IN VIEW ORDER BY length DESC LIMIT 10

# Pathogenic variants in BRCA1
SELECT VARIANTS WITHIN BRCA1 WHERE clin CONTAINS pathogenic

# Genes ranked by how many variants they contain
SELECT GENES INTERSECT variants ORDER BY count DESC

# The most variants found in any single gene
SELECT MAX(count) GENES INTERSECT variants

# All features from a specific track in current view
SELECT * FROM my-track IN VIEW

# CDS features on the plus strand
SELECT FEATURES WHERE type = CDS AND strand = +
```

---

## Coverage Queries

Find regions of a BAM/CRAM alignment track that meet a depth threshold. gBeta
streams data through the BAM index and computes coverage only for the queried
region, so it scales to large files.

### Syntax

```
SELECT REGIONS WHERE coverage >= <depth> [IN <region>]
```

### Examples

```
SELECT REGIONS WHERE coverage >= 10
SELECT REGIONS WHERE coverage >= 15 IN chr1:1000-2000
```

Natural language: *"find high coverage regions"*, *"show areas with coverage
above 20"*. Requires a BAM or CRAM track to be loaded.

---

## COUNT Queries

Count features without listing them.

### Syntax

Same as SELECT, but returns only the count.

```
COUNT <what> [clauses...]
```

### Examples

```
COUNT GENES                           # Total genes
COUNT VARIANTS IN VIEW                # Variants in viewport
COUNT GENES INTERSECT variants        # Genes with variants
COUNT FEATURES WHERE type = 'exon'    # Number of exons
```

---

## Coordinate Formats

gBeta accepts various coordinate formats:

| Format | Example | Notes |
|--------|---------|-------|
| Standard | chr17:7668421-7687490 | Most common |
| With commas | chr17:7,668,421-7,687,490 | For readability |
| Short form | chr17:7668421 | Single position (1bp range) |
| Spaces | chr17: 7668421 - 7687490 | Spaces are stripped |

All coordinates are **1-based, inclusive** following genomics convention.

---

## Natural Language Translation

gBeta automatically translates natural language to GQL:

| Natural Language | GQL Translation |
|------------------|-----------------|
| "go to TP53" | `search gene TP53` |
| "show chr17:7668421-7687490" | `navigate chr17:7668421-7687490` |
| "zoom in" | `zoom in` |
| "move left" | `pan left 10kb` |
| "show only exons" | `filter type=exon` |
| "show plus strand" | `filter strand=+` |
| "which genes here have variants" | `SELECT GENES INTERSECT variants IN VIEW` |
| "pathogenic variants in BRCA1" | `SELECT VARIANTS WHERE clin CONTAINS pathogenic WITHIN BRCA1` |
| "fewest variants in any gene" | `SELECT MIN(count) GENES INTERSECT variants` |
| "highlight TP53" | `highlight TP53` |
| "clear everything" | `clear all` |

Coordinate navigation and gene-symbol lookup are deterministic and need no AI.
Free-text questions like the data queries above are translated by the AI — use
the conversational **Ask AI** panel (which also runs the query and shows
clickable results), or the Console to review/edit the GQL before running. See the
[AI Setup Guide](AI-SETUP.md).

### Tips

- Be specific: "filter to exons" is clearer than "show exons"
- Gene names work directly: typing "TP53" navigates there
- Coordinates are auto-detected and converted to navigate commands
- For "which/most/fewest/average", the AI returns a `SELECT`/aggregate so you get a ranked, clickable list — not a guessed single answer

---

## Error Handling

If a query fails, gBeta provides helpful error messages:

| Error | Meaning | Solution |
|-------|---------|----------|
| "Invalid coordinates" | Malformed chr:start-end | Check coordinate format |
| "Gene not found" | Unknown gene name | Verify spelling, try search |
| "Track not found" | FROM references missing track | Load the track first |
| "No filter criteria" | Empty filter command | Add field=value pairs |
| "Unknown command" | Unrecognized GQL | Check command spelling |

---

## See Also

- [GQL Examples](GQL-EXAMPLES.md) - Practical use cases
- [Getting Started Tutorial](tutorials/01-getting-started.md) - First-time users

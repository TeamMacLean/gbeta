# GQL Examples

Practical examples of gBeta Query Language for common genomics tasks.

## Table of Contents

- [Navigation](#navigation)
- [Gene Exploration](#gene-exploration)
- [Variant Analysis](#variant-analysis)
- [Feature Filtering](#feature-filtering)
- [Region Highlighting](#region-highlighting)
- [Data Queries](#data-queries)
- [Complex Analysis](#complex-analysis)

---

## Navigation

### Go to a specific region

```
navigate chr17:7668421-7687490
```

Or use the shorthand:

```
goto chr17:7668421-7687490
go chr17:7668421-7687490
```

### Navigate to a gene

```
search gene TP53
```

Just the gene name also works:

```
TP53
```

### Move around the current view

```
# Zoom controls
zoom in              # 2x closer
zoom out             # 2x farther
zoom 4x              # 4x farther
zoom 0.5x            # 2x closer (same as zoom in)

# Pan controls
pan left 10kb        # Move left 10,000 bp
pan right 50000      # Move right 50,000 bp
pan left 1mb         # Move left 1 megabase
```

---

## Gene Exploration

### Find a cancer-related gene

```
search gene BRCA1
```

### View the TP53 tumor suppressor

```
navigate chr17:7668421-7687490
```

### See coding sequences only

```
filter type=CDS
```

### Show exon structure

```
filter type=exon
```

### View plus strand genes

```
filter strand=+
```

### Combine filters

```
filter type=exon strand=+
```

### Clear filters to see everything

```
clear filters
```

---

## Variant Analysis

### List all loaded variants

```
list variants
```

### Find variants in a specific gene

```
list variants in TP53
list variants in BRCA1
list variants in EGFR
```

### Find genes that contain variants

```
list genes with variants
```

### Find pathogenic variants

```
list pathogenic variants
```

### Count variants in view

```
COUNT VARIANTS IN VIEW
```

### Query variants with specific properties

```
SELECT VARIANTS WHERE clin CONTAINS pathogenic
SELECT VARIANTS WHERE impact = nonsense
SELECT VARIANTS WHERE ref = A AND alt = G
```

---

## Feature Filtering

### Show only exons

```
filter type=exon
```
*Natural language: "show only exons", "filter to exons"*

### Show only coding sequences (CDS)

```
filter type=CDS
```

### Show features on plus strand

```
filter strand=+
```
*Natural language: "show plus strand", "filter to forward strand"*

### Show features on minus strand

```
filter strand=-
```
*Natural language: "show minus strand", "filter to reverse strand"*

### Filter by score (BED files)

```
filter score>100
filter score>=75
```

### Multiple conditions

```
filter type=exon strand=+
filter type=CDS score>50
```

### Reset all filters

```
clear filters
```
*Natural language: "clear filters", "remove filters", "reset"*

---

## Region Highlighting

### Highlight a specific region

```
highlight chr17:7670000-7675000
```

### Highlight multiple regions

```
highlight chr17:7668000-7670000
highlight chr17:7680000-7687000
```

### Highlight a gene region

Natural language translates gene names to coordinates:

*"highlight TP53"* becomes:

```
highlight chr17:7668421-7687490
```

### Clear all highlights

```
clear highlights
```

### Clear everything (filters + highlights)

```
clear all
```

---

## Data Queries

### List all genes

```
list genes
```
*Natural language: "show genes", "what genes are there"*

### List genes in current view

```
SELECT GENES IN VIEW
```

### List genes on current chromosome

```
SELECT GENES IN CHROMOSOME
```

### List all variants

```
list variants
```

### Count features

```
COUNT GENES
COUNT VARIANTS
COUNT VARIANTS IN VIEW
COUNT GENES IN chr17
```

---

## Complex Analysis

### Find the 10 longest genes

```
SELECT GENES ORDER BY length DESC LIMIT 10
```

### Find genes overlapping variants

```
SELECT GENES INTERSECT variants
```

### Find variants within TP53

```
SELECT VARIANTS WITHIN TP53
```

### Find pathogenic variants in cancer genes

```
SELECT VARIANTS WITHIN BRCA1 WHERE clin CONTAINS pathogenic
SELECT VARIANTS WITHIN TP53 WHERE clin CONTAINS pathogenic
```
*Use your VCF's actual INFO field name (e.g. `clin`, `clnsig`, `impact`). The
Console and AI list the available fields for each loaded track.*

### Rank genes by variant count

```
SELECT GENES INTERSECT variants ORDER BY count DESC
```
*After `INTERSECT`, each gene carries a `count` field (number of overlapping
variants); the list is shown ranked by it.*

### Filter genes by their variant count

```
SELECT GENES INTERSECT variants WHERE count >= 3     # genes with 3 or more
SELECT GENES INTERSECT variants WHERE count = 1      # genes with exactly one
```

### Aggregate the variant counts

```
SELECT MIN(count) GENES INTERSECT variants    # fewest variants in any gene
SELECT MAX(count) GENES INTERSECT variants    # most variants in any gene
SELECT AVG(count) GENES INTERSECT variants    # mean variants per gene
SELECT SUM(count) GENES INTERSECT variants    # total
```
*`MIN`/`MAX` also list the genes that hit the extreme — clickable, so the answer
is one click from the view.*

### Find high-coverage regions (BAM/CRAM)

```
SELECT REGIONS WHERE coverage >= 10
SELECT REGIONS WHERE coverage >= 15 IN chr1:1000-2000
```

### Query a specific track

```
SELECT * FROM my-annotations IN VIEW
SELECT GENES FROM reference-genes WHERE strand = '+'
SELECT FEATURES FROM peaks WHERE score > 100
```

### Combine track intersection with filtering

```
SELECT GENES FROM annotations INTERSECT variants WHERE strand = '+' ORDER BY length DESC LIMIT 5
```

---

## Real-World Scenarios

### Scenario 1: Check a gene of interest

You want to examine TP53, a well-known tumor suppressor:

```
search gene TP53        # Navigate to the gene
filter type=exon        # Focus on exon structure
zoom in                 # Get a closer look
clear filters           # See full annotation
```

### Scenario 2: Find variants in candidate genes

You have a VCF loaded and want to check specific genes:

```
list variants in BRCA1   # Check BRCA1
list variants in BRCA2   # Check BRCA2
list variants in TP53    # Check TP53
```

### Scenario 3: Identify genes affected by variants

```
list genes with variants              # Quick overview
SELECT GENES INTERSECT variants ORDER BY length DESC LIMIT 10   # Top 10 largest affected genes
```

### Scenario 4: Focus on coding changes

```
filter type=CDS                       # Show only coding sequences
SELECT VARIANTS IN VIEW               # List variants in current view
```

### Scenario 5: Prepare a figure

```
navigate chr17:7668421-7687490        # Set exact coordinates
highlight chr17:7670000-7675000       # Highlight region of interest
filter type=exon                      # Clean visualization
```

---

## Tips and Tricks

### Use coordinates for precision

When you need exact reproducibility, use explicit coordinates:

```
navigate chr17:7668421-7687490
```

Instead of:

```
search gene TP53
```

### Chain commands mentally

Build up complex views step by step:

1. Navigate: `goto TP53`
2. Load data: (drag and drop)
3. Filter: `filter type=exon`
4. Highlight: `highlight chr17:7670000-7675000`

### Reset when confused

```
clear all
```

This removes all filters and highlights, giving you a clean slate.

### Use natural language for discovery

Type a question in plain English — in the conversational **Ask AI** panel
(bottom-right), the Console, or the search bar:

- "which genes here have variants?"
- "show pathogenic variants in BRCA1"
- "what's the fewest variants in any gene?"
- "go to chromosome 17"

The Ask AI panel runs the query and shows a ranked, clickable result list; the
Console shows you the editable GQL first. Either way you get a reproducible
command you can save, export (`.gql`), or keep as a re-runnable **Analysis**.

---

## See Also

- [GQL Manual](GQL-MANUAL.md) - Complete command reference
- [AI Setup Guide](AI-SETUP.md) - Configure the Ask AI panel
- [Getting Started Tutorial](tutorials/01-getting-started.md) - Step-by-step introduction

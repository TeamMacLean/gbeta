# Tutorial 3: Advanced Queries

> **Audience**: Bioinformaticians doing QC and complex multi-track analysis
> **Time**: 30-45 minutes
> **Prerequisites**: Comfortable with GQL basics ([Tutorial 1](01-getting-started.md))
> **Last updated**: Session 23 (2026-01-22)

## What You'll Learn

- SELECT query syntax in depth
- Filtering by numeric values (scores, lengths)
- INTERSECT and WITHIN clauses
- ORDER BY and LIMIT for result control
- Combining multiple query conditions
- Performance optimization tips

## Scenario

You're a bioinformatician doing QC on ChIP-seq data. You have:
- Peak calls (BED with scores)
- Signal track (bedGraph)

The gene annotations load automatically from the selected assembly.

You need to check peak quality and promoter overlap.

---

## Step 1: Set Up Your Tracks

### Automatic tracks

gBeta loads gene/transcript tracks automatically. You should see:
- **Transcripts** in the sidebar

### Load your analysis files

Drag and drop your files:
1. `peaks.bed` - Your ChIP-seq peaks with scores
2. `signal.bedgraph` - Coverage/signal track (optional)

> [!TIP]
> For large peak files, use indexed formats: BigBed (`.bb`) for intervals or tabix-indexed BED (`.bed.gz` + `.tbi`). These load instantly regardless of file size.

### Verify tracks loaded

You should see your tracks in the sidebar below the automatic gene tracks.

---

## Step 2: SELECT Query Anatomy

The SELECT query is gBeta's most powerful command.

### Basic syntax

```
SELECT <what> [FROM <track>] [clauses...]
```

### What to select

| Keyword | Selects |
|---------|---------|
| GENES | Gene features |
| VARIANTS | Variant features |
| FEATURES | All feature types |
| * | Everything |
| ALL | Everything |

<details>
<summary>SELECT Query Syntax Reference</summary>

```
SELECT <what> [FROM <track>] [WHERE <conditions>] [INTERSECT <track>] [WITHIN <region>] [IN <scope>] [ORDER BY <field>] [LIMIT <n>]
```

| Clause | Purpose |
|--------|---------|
| FROM | Source track |
| WHERE | Filter conditions |
| INTERSECT | Require overlap |
| WITHIN | Inside region/gene |
| IN | Scope (VIEW, CHROMOSOME) |
| ORDER BY | Sort results |
| LIMIT | Max results |

</details>

---

## Step 3: Filtering by Score

BED files often include scores. Query high-confidence peaks.

### Find high-scoring peaks

```
SELECT FEATURES FROM peaks WHERE score > 100
```

### Score thresholds

```
SELECT FEATURES FROM peaks WHERE score >= 500
SELECT FEATURES FROM peaks WHERE score > 50 AND score < 200
```

### Count by score range

```
COUNT FEATURES FROM peaks WHERE score > 100
COUNT FEATURES FROM peaks WHERE score <= 50
```

---

## Step 4: INTERSECT Queries

Find features that overlap between tracks.

> [!IMPORTANT]
> Track names in `FROM` clauses must match exactly what's shown in the sidebar.

### Peaks overlapping genes

```
SELECT FEATURES FROM peaks INTERSECT genes
```

### Genes with peaks

```
SELECT GENES INTERSECT peaks
```

### Count overlaps

```
COUNT GENES INTERSECT peaks
COUNT FEATURES FROM peaks INTERSECT genes
```

### With score filter

```
SELECT FEATURES FROM peaks WHERE score > 100 INTERSECT genes
```

---

## Step 5: WITHIN Queries

Find features inside a gene or region.

### Features within a gene

```
SELECT FEATURES WITHIN TP53
SELECT FEATURES FROM peaks WITHIN BRCA1
```

### Features within a region

```
SELECT FEATURES WITHIN chr17:7668421-7687490
SELECT * FROM peaks WITHIN chr1:1000000-2000000
```

### Combined with filters

```
SELECT FEATURES FROM peaks WHERE score > 100 WITHIN TP53
```

---

## Step 6: IN Scope Queries

Limit queries to current view or chromosome.

> [!TIP]
> Use `IN VIEW` to limit queries to the current viewport - much faster for large datasets.

### Current viewport

```
SELECT GENES IN VIEW
SELECT FEATURES FROM peaks IN VIEW
```

### Current chromosome

```
SELECT GENES IN CHROMOSOME
SELECT VARIANTS IN CHROMOSOME
```

### Specific chromosome

```
SELECT GENES IN chr17
SELECT FEATURES FROM peaks IN chrX
```

### Specific region

```
SELECT GENES IN chr17:7000000-8000000
```

---

## Step 7: ORDER BY and LIMIT

Sort and limit results.

> [!TIP]
> Add `LIMIT 100` to prevent slow queries when exploring unfamiliar data.

### Sort by name

```
SELECT GENES ORDER BY name ASC
SELECT GENES ORDER BY name DESC
```

### Sort by length

```
SELECT GENES ORDER BY length DESC
SELECT GENES ORDER BY (end - start) DESC
```

### Sort by position

```
SELECT FEATURES ORDER BY start ASC
```

### Top N results

```
SELECT GENES ORDER BY length DESC LIMIT 10
SELECT FEATURES FROM peaks WHERE score > 100 ORDER BY score DESC LIMIT 20
```

---

## Step 8: Complex Combined Queries

### Top 10 longest genes with peaks

```
SELECT GENES INTERSECT peaks ORDER BY length DESC LIMIT 10
```

### High-scoring peaks in genes, current view

```
SELECT FEATURES FROM peaks WHERE score > 100 INTERSECT genes IN VIEW
```

### Count genes with high-scoring peaks

```
COUNT GENES INTERSECT (SELECT FROM peaks WHERE score > 100)
```

Or simpler:

```
SELECT GENES INTERSECT peaks WHERE score > 100
```

### Promoter regions with peaks

If you have a promoter track:

```
SELECT FEATURES FROM promoters INTERSECT peaks ORDER BY score DESC
```

---

## Step 9: Working with Gene Structures

### Filter to specific feature types

```
filter type=exon
filter type=CDS
filter type=UTR
```

### Query specific feature types

In SELECT queries, use WHERE:

```
SELECT FEATURES WHERE type = 'exon' IN VIEW
SELECT FEATURES WHERE type = 'CDS' AND strand = '+'
```

### Count feature types

```
COUNT FEATURES WHERE type = 'exon'
COUNT FEATURES WHERE type = 'CDS'
```

---

## Step 10: Strand-Specific Analysis

### Filter by strand

```
filter strand=+
filter strand=-
```

### Query by strand

```
SELECT GENES WHERE strand = '+' IN VIEW
SELECT FEATURES WHERE strand = '-' ORDER BY start ASC
```

### Separate strand counts

```
COUNT GENES WHERE strand = '+'
COUNT GENES WHERE strand = '-'
```

---

## QC Workflow Example

Complete workflow for ChIP-seq peak QC:

```
# 1. Load tracks (drag and drop peaks.bed, signal.bedgraph)
#    Gene tracks load automatically from the assembly

# 2. Check total peak count
COUNT FEATURES FROM peaks

# 3. Check score distribution
COUNT FEATURES FROM peaks WHERE score > 100
COUNT FEATURES FROM peaks WHERE score > 500
COUNT FEATURES FROM peaks WHERE score > 1000

# 4. Find peaks in promoters (if you have promoter track)
SELECT FEATURES FROM peaks INTERSECT promoters

# 5. Check gene overlap
COUNT GENES INTERSECT peaks
SELECT GENES INTERSECT peaks ORDER BY name ASC

# 6. Find top peaks
SELECT FEATURES FROM peaks ORDER BY score DESC LIMIT 20

# 7. Visual inspection of top hits
# Click results to navigate, or:
navigate chr17:7668421-7687490
zoom in

# 8. Check specific regions of interest
SELECT FEATURES FROM peaks WITHIN TP53
SELECT FEATURES FROM peaks WITHIN BRCA1
```

---

## Performance Tips

> [!WARNING]
> Queries without `IN VIEW` or `LIMIT` may be slow on large datasets.

### Use IN VIEW for large datasets

```
SELECT GENES IN VIEW              # Fast - limited scope
SELECT GENES                      # Slower - all genes
```

### LIMIT large result sets

```
SELECT FEATURES ORDER BY score DESC LIMIT 100
```

### Filter early in query

```
SELECT FEATURES FROM peaks WHERE score > 100 INTERSECT genes
# Better than:
SELECT FEATURES FROM peaks INTERSECT genes WHERE score > 100
```

---

## Try It Yourself

Practice with E. coli test data:

### Setup

1. Select assembly **E. coli K-12 MG1655**
2. Load the test GFF (has genes with scores):
   ```
   https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.gff3.gz
   ```

### Practice queries

```
# Navigate to a gene-rich region
navigate NC_000913.3:100000-200000

# Count features in view
COUNT FEATURES IN VIEW

# Find features by type
SELECT FEATURES WHERE type = 'gene' IN VIEW

# Sort by position
SELECT FEATURES WHERE type = 'gene' ORDER BY start ASC LIMIT 10

# Count by strand
COUNT FEATURES WHERE strand = '+'
COUNT FEATURES WHERE strand = '-'
```

### Challenge

Write a query to find the 5 longest genes on the positive strand in the current view.

<details>
<summary>Solution</summary>

```
SELECT FEATURES WHERE type = 'gene' AND strand = '+' IN VIEW ORDER BY length DESC LIMIT 5
```

</details>

---

## Troubleshooting

### "Track not found"

Check track names in the sidebar. Use exact name:

```
SELECT * FROM sample-genes.bed    # Use exact filename
```

### Empty results

- Check chromosome naming (chr1 vs 1)
- Verify tracks are loaded
- Try broader query first, then add filters

### Slow queries

- Add IN VIEW to limit scope
- Add LIMIT to cap results
- Use indexed tracks when available

---

## Summary

You now know how to:

- Write complex SELECT queries with multiple clauses
- Filter features by score, type, and strand
- Use INTERSECT to find overlapping features between tracks
- Use WITHIN to find features inside genes or regions
- Control query scope with IN VIEW/CHROMOSOME
- Sort and limit results with ORDER BY and LIMIT
- Optimize query performance for large datasets

---

## What's Next?

- [Tutorial 4: Non-Model Genomes](04-non-model-genomes.md) - Custom assemblies
- [Tutorial 5: Reproducible Analysis](05-reproducible-analysis.md) - Save and share
- [GQL Manual](../GQL-MANUAL.md) - Complete reference

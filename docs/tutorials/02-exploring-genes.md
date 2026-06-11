# Tutorial 2: Exploring Genes and Variants

> **Audience**: Bench biologists working with gene lists and variants
> **Time**: 20-30 minutes
> **Prerequisites**: Basic familiarity with genome browsers ([Tutorial 1](01-getting-started.md) recommended)
> **Last updated**: Session 23 (2026-01-22)

## What You'll Learn

- Loading variant data (VCF files)
- Finding genes that contain variants
- Querying overlaps between genes and variants
- Visual inspection of variant positions
- Filtering by clinical significance

## Scenario

You're a wet lab scientist who just received:
- A VCF file with variants from a patient sample

You want to know: **Which genes have variants, and are any clinically significant?**

> [!NOTE]
> Gene tracks load automatically for the selected assembly - you only need to load your variant data.

---

## Step 1: Verify Gene Tracks Are Loaded

gBeta automatically loads gene tracks for the selected assembly.

### Check the sidebar

You should see:
- **Transcripts** - Shows transcript structures with exons
- **Genes** (if available) - Shows gene-level features

If you don't see these tracks:
1. Check you're on a supported assembly (GRCh38, mm39, etc.)
2. Wait a moment for remote data to load
3. Try refreshing the page

### Optional: Load custom gene annotations

If you have your own gene list (BED or GFF3):
1. Drag and drop the file onto the canvas
2. Or use **File** tab in sidebar

### BED file format reminder

Your BED file should look like this:

```
chr17   7668421   7687490   TP53
chr17   43044295  43170245  BRCA1
chr13   32315086  32400266  BRCA2
```

Columns: chromosome, start, end, name (optional)

---

## Step 2: Load Your Variants

### Option A: Tabix-indexed VCF (recommended)

For best performance, use tabix-indexed VCF files (`.vcf.gz` + `.vcf.gz.tbi`):

**From URL:**
1. Click the **URL** tab in the sidebar
2. Paste your `.vcf.gz` URL (index auto-discovered at `.vcf.gz.tbi`)
3. Click **+** to add

**From local files:**
1. Click the **File** tab in the sidebar
2. Select both `.vcf.gz` and `.vcf.gz.tbi` together
3. Or drag and drop both files onto the canvas

> [!TIP]
> Indexed VCFs only load data for the current viewport - much faster for large files!

### Option B: Plain VCF (small files only)

For small VCF files (under a few MB), you can drag and drop an uncompressed `.vcf` file directly. This loads the entire file into memory.

### Verify variants loaded

- A new track appears in the sidebar
- Variants display as colored markers
- The track is named after your VCF file

### VCF compatibility

gBeta supports standard VCF format. Key fields used:
- CHROM, POS, ID, REF, ALT (required)
- QUAL, FILTER, INFO (optional but useful)
- Clinical significance (CLNSIG in INFO) for filtering

> [!IMPORTANT]
> Ensure your VCF uses the same chromosome naming convention as the assembly (chr1 vs 1).

---

## Step 3: Find Genes with Variants

Now the exciting part - finding which genes contain variants.

### Natural language query

Type in the search bar:

```
show me genes with variants
```

gBeta translates this to GQL and shows results.

### GQL equivalent

```
list genes with variants
```

### Understanding the results

A results panel appears showing:
- Gene names
- Chromosomal locations
- Number of overlapping variants

> [!TIP]
> Click any result in the query output to navigate directly to that location.

---

## Step 4: Inspect a Specific Gene

Let's look at one gene in detail.

### Navigate to it

Click a gene in the results list, or type:

```
search gene BRCA1
```

### Zoom in

```
zoom in
zoom in
```

Or scroll up with your mouse.

### View the overlap

You should see:
- Your gene annotation (from the assembly or your BED file)
- Variant markers (from VCF)
- The overlap is now visually obvious

---

## Step 5: Query Variants in a Gene

Get details about variants in a specific gene.

### List variants

```
list variants in BRCA1
```

> [!TIP]
> Use `COUNT` instead of `list` to quickly see how many matches exist without loading all results.

### Results show

- Variant position
- Reference allele
- Alternate allele(s)
- Clinical significance (if in VCF)

### For any gene

Replace `BRCA1` with any gene name:

```
list variants in TP53
list variants in EGFR
list variants in MYC
```

---

## Step 6: Filter by Clinical Significance

If your VCF has clinical annotations, find the important ones.

### Find pathogenic variants

```
list pathogenic variants
```

### Or use SELECT syntax

```
SELECT VARIANTS WHERE significance = 'pathogenic'
SELECT VARIANTS WHERE significance CONTAINS 'pathogenic'
```

---

## Step 7: Highlight Regions of Interest

Mark regions you want to return to.

### Highlight a gene

```
highlight chr17:43044295-43170245
```

### Highlight around a variant

After finding an interesting variant at position chr17:43091570:

```
highlight chr17:43091000-43092000
```

### Clear when done

```
clear highlights
```

---

## Step 8: Advanced Queries

### Count variants per gene

```
SELECT GENES INTERSECT variants ORDER BY name ASC
```

Results include variant count in details column.

### Find most affected genes

```
SELECT GENES INTERSECT variants ORDER BY length DESC LIMIT 10
```

### Query specific tracks

```
SELECT GENES FROM my-genes INTERSECT variants IN VIEW
```

---

## Try It Yourself

Let's analyze real E. coli variant data:

### Load the test VCF

1. Select assembly **E. coli K-12 MG1655** from the dropdown
2. Click the **URL** tab in sidebar
3. Paste this URL:
   ```
   https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.vcf.gz
   ```
4. Click **+** to add the track

### Explore the variants

```
# Navigate to a region with variants
navigate NC_000913.3:100000-200000

# Count variants in view
COUNT VARIANTS IN VIEW

# List all variants
list variants

# Zoom in to see variant details
zoom in
zoom in
```

### What you should see

- Variant markers on the canvas
- Click a variant to see its details (position, ref/alt alleles)
- At high zoom, you can see the exact nucleotide changes

### Exercise: Find genes with variants

Try answering these questions using GQL:

- [ ] How many variants are in the current view?
- [ ] Which genes have variants?
- [ ] How many variants are in a specific gene?

<details>
<summary>Solution</summary>

```
# Count variants in view
COUNT VARIANTS IN VIEW

# List genes with variants
list genes with variants

# Count variants in a specific gene (replace GENENAME)
list variants in GENENAME
```

</details>

---

## Tips for Bench Biologists

### Start with questions

Ask gBeta in natural language:
- "What genes have variants?"
- "Show me variants in BRCA1"
- "Are there pathogenic variants?"

### Visual verification matters

After finding overlaps computationally, always zoom in to visually confirm. You might notice:
- Variants at splice sites
- Clusters of variants
- UTR vs coding variants

### Filter to focus

When viewing complex regions:
- `filter type=CDS` - focus on coding changes
- `filter type=exon` - see exon boundaries
- `filter strand=+` or `strand=-` - separate strands

### Document your findings

Use highlights to mark regions, then take screenshots or note coordinates for your lab notebook.

---

## Common Issues

> [!WARNING]
> Chromosome naming mismatches are the most common cause of "no results" - check that your VCF uses the same convention as your assembly.

### "No variants found in gene X"

- The gene might not have variants (good news!)
- Check chromosome naming (chr17 vs 17)
- Verify the gene coordinates overlap with your VCF

### "Gene X not found"

- Check spelling (BRCA1, not Brca1)
- The gene might not be in the built-in index
- Load a GFF3 file with your gene annotations

### Variant track looks empty

- You might be viewing a chromosome with no variants
- Try zooming out
- Navigate to a chromosome mentioned in your VCF

### Tracks misaligned

- Ensure both files use the same genome assembly (e.g., GRCh38)
- Chromosome names must match (chr1 vs 1)

---

## Summary

Key points for variant analysis in gBeta:

1. **Gene tracks load automatically** - No need to find gene annotations
2. **Load your VCF** - Drag & drop or paste URL for tabix-indexed files
3. **Query overlaps** - Use `list genes with variants` or GQL SELECT
4. **Visual inspection** - Click results to navigate, zoom in to see details
5. **Filter by significance** - Use WHERE clauses for clinical filtering

---

## Next Steps

- [Tutorial 3: Advanced Queries](03-advanced-queries.md) - Complex GQL queries
- [GQL Examples](../GQL-EXAMPLES.md) - More query patterns
- [GQL Manual](../GQL-MANUAL.md) - Complete reference

# Tutorial 1: Getting Started

> **Audience**: First-time users and students learning genomics
> **Time**: 15-20 minutes
> **Prerequisites**: A modern web browser (Chrome, Firefox, Safari, Edge)
> **Last updated**: Session 23 (2026-01-22)

## What You'll Learn

- Understanding the gBeta interface
- Navigating the genome (search, pan, zoom)
- Loading local and remote data files
- Using basic filters and highlights
- Customizing themes and colors

---

## Step 1: Opening gBeta

Open gBeta in your web browser. You'll see a clean interface with:

- **Header** (top): Search bar and navigation controls
- **Sidebar** (left): Track list and file loading
- **Main area** (center): Genomic visualization canvas
- **GQL Console tab** (bottom): Click to open the advanced query interface

The browser starts with a default view of chromosome 1 in the human genome.

> [!NOTE]
> Gene tracks load automatically for most assemblies. You don't need to find gene annotations yourself.

---

## Step 2: Two Ways to Query

gBeta provides two interfaces for entering commands: the **Search Bar** for quick tasks and the **GQL Console** for advanced work.

### Search Bar (Header)

The search bar in the header is perfect for quick navigation:

- Type a gene name: `TP53`
- Type coordinates: `chr17:7668421-7687490`
- Type simple commands: `zoom in`, `pan left 10kb`

The search bar uses basic pattern matching - it works offline and responds instantly. Results appear inline next to the search bar.

> [!TIP]
> Press `/` on your keyboard to quickly focus the search bar.

### GQL Console (Bottom Panel)

For more complex queries, use the GQL Console:

1. Click the **GQL Console** tab at the bottom of the screen (or press `Cmd+`` / `Ctrl+``)
2. The console panel slides up, showing:
   - **Natural Language input** (top-left): Type questions in plain English
   - **GQL input** (bottom-left): View and edit the generated query
   - **Results panel** (center): Clickable list of results
   - **History/Saved** (right): Session history and saved queries

**When to use the Console:**

- Complex queries: `SELECT GENES INTERSECT variants ORDER BY length DESC`
- AI-powered natural language: "show me genes with high-impact variants" (requires [AI setup](../AI-SETUP.md))
- Saving queries for reproducibility
- Sharing queries via URL
- Exporting query collections

**Key difference:** The Search Bar is quick and local. The GQL Console is powerful and can use AI for natural language understanding.

For this tutorial, we'll use the Search Bar. You can try the GQL Console later - see [Tutorial 5: Reproducible Analysis](05-reproducible-analysis.md) for advanced usage.

---

## Step 3: Searching for a Gene

Let's find TP53, a famous tumor suppressor gene often mutated in cancer.

### Using the search bar

1. Click the search bar at the top (or press `/` on your keyboard)
2. Type: `TP53`
3. Press Enter

gBeta navigates to chromosome 17 where TP53 is located. You should see the coordinate display change to something like `chr17:7,668,421-7,687,490`.

### What just happened?

When you typed `TP53`, gBeta:

1. Recognized it as a gene name
2. Looked up its coordinates (chr17:7668421-7687490)
3. Navigated the view to show that region

---

## Step 4: Zooming In and Out

### Using buttons

- Click the **+** button to zoom in (see more detail)
- Click the **-** button to zoom out (see more context)

### Using your mouse/trackpad

- **Scroll up** to zoom in
- **Scroll down** to zoom out

> [!TIP]
> Scroll with your mouse wheel to zoom in and out quickly.

### Using commands

Type in the search bar:

```
zoom in
```

or

```
zoom out
```

### Try it!

Zoom in several times until you can see individual features (exons, CDS regions). Then zoom out to see the gene in its genomic context.

---

## Step 5: Panning

Move left or right along the chromosome.

### Using your mouse

Click and drag on the canvas to pan.

### Using commands

```
pan left 10kb
pan right 10kb
```

### Try it!

Pan around to explore the region near TP53. What other genes are nearby?

---

## Step 6: Loading a Data File

gBeta can display your own genomic data. Let's try loading a file.

### Supported formats

**Indexed formats** (recommended for large files):

| Format | Extensions | Index | Use for |
|--------|------------|-------|---------|
| BigBed | .bb, .bigbed | Built-in | Intervals |
| BigWig | .bw, .bigwig | Built-in | Signal/coverage |
| BAM | .bam | .bam.bai | Alignments |
| CRAM | .cram | .cram.crai | Alignments (smaller) |
| Tabix VCF | .vcf.gz | .vcf.gz.tbi | Variants |
| Tabix GFF | .gff.gz | .gff.gz.tbi | Gene annotations |
| Tabix BED | .bed.gz | .bed.gz.tbi | Intervals |

These work both locally (drag and drop) and remotely (paste URL). gBeta only loads the data you're viewing, so even multi-gigabyte files open instantly.

> [!TIP]
> For indexed files with external indexes (.bai, .tbi), select both files together when loading locally.

**Plain text formats** (small files only):

| Format | Extension | Use for |
|--------|-----------|---------|
| BED | .bed | Small interval lists |
| GFF3 | .gff3, .gff | Small annotations |
| VCF | .vcf | Small variant sets |
| bedGraph | .bedgraph | Small signal data |

These are loaded entirely into memory - fine for files under a few MB, but use indexed formats for larger data.

### Loading a file

**Option A: From URL** (recommended for large files)

1. Click the **URL** tab in the sidebar
2. Paste a URL to any indexed format (BigBed, BigWig, BAM, tabix, etc.)
3. Click **+** to add the track
4. The index file is auto-discovered (must be at same URL path)

**Option B: Local files**

1. Look at the **Add Tracks** section in the sidebar
2. The **File** tab is selected by default
3. Click **Drop or browse** to select files
4. For indexed files (BAM, tabix), select both the data file AND index file together

**Option C: Drag and drop**

1. Drag files from your computer onto the gBeta window
2. For indexed files, drag both the data and index files together
3. Drop anywhere on the canvas

> [!WARNING]
> Chromosome names must match between your files and the assembly (e.g., `chr1` vs `1`).

### What happens next?

Your data appears as a new track below the main view. Each track shows a different type of information at the same genomic position.

---

## Step 7: Using Filters

When viewing gene annotations (GFF3 files), you can filter to focus on specific feature types.

### Show only exons

```
filter type=exon
```

Exons (coding parts of genes) appear bright; everything else dims.

### Show only coding sequences

```
filter type=CDS
```

### Show features on a specific strand

```
filter strand=+
```

Shows features on the plus (forward) strand.

### Clear filters

```
clear filters
```

Returns to showing all features normally.

---

## Step 8: Highlighting Regions

Mark regions of interest with highlights.

### Highlight a region

```
highlight chr17:7670000-7675000
```

A colored overlay appears over that region.

### Clear highlights

```
clear highlights
```

---

## Step 9: Customizing Appearance

gBeta offers multiple themes and color palettes.

### Opening Settings

Click the **Settings** button (gear icon) in the header.

### Changing theme

In the **Display** tab:
- **Light** (default) - Clean, print-ready
- **Dark** - Easier on eyes in low light
- **High-Contrast** - Maximum readability

### Changing color palette

Choose from colorblind-safe palettes:
- **Set2** (default) - Soft, distinct colors
- **Dark2** - Bolder colors
- **Paired** - High contrast pairs

Changes apply immediately and persist across sessions.

---

## Try It Yourself

Load a remote BAM file to see alignments:

1. Select assembly **E. coli K-12 MG1655** from the assembly dropdown
2. Click the **URL** tab in the sidebar
3. Paste this URL:
   ```
   https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.bam
   ```
4. Click **+** to add the track
5. Navigate to `NC_000913.3:100000-100500`
6. Zoom in to see individual reads

You've just loaded remote alignment data without downloading anything!

---

## Quick Reference

| Action | How |
|--------|-----|
| Search for gene | Type gene name, press Enter |
| Go to coordinates | Type `chr17:1000000-2000000` |
| Zoom in | Scroll up, or type `zoom in` |
| Zoom out | Scroll down, or type `zoom out` |
| Pan | Click and drag, or type `pan left 10kb` |
| Load file | Drag and drop |
| Load remote file | Sidebar URL tab, paste URL |
| Filter features | Type `filter type=exon` |
| Clear filters | Type `clear filters` |
| Highlight region | Type `highlight chr17:1000-2000` |
| Change theme | Settings > Display |

---

## Common Questions

<details>
<summary>Why can't I find my gene?</summary>

gBeta has a built-in index of common genes. If your gene isn't found:
- Check the spelling
- Try the official gene symbol (BRCA1, not "breast cancer gene")
- Load a GFF3 file containing your gene annotations

</details>

<details>
<summary>My file won't load!</summary>

Check that:
- The file has the correct extension (.bed, .gff3, .vcf, .bedgraph)
- The file isn't too large (stay under 100MB for best performance)
- The chromosome names match (chr1 vs 1)

</details>

<details>
<summary>Everything disappeared!</summary>

You might have zoomed out too far. Try:
- Searching for a gene to navigate back
- Type `navigate chr1:1-1000000` for a default view

</details>

<details>
<summary>The tracks overlap!</summary>

Each track needs space. Try:
- Closing tracks you don't need
- Zooming out for a wider view

</details>

---

## Summary

You now know how to:
- Navigate the gBeta interface
- Search for genes and navigate to coordinates
- Zoom in/out and pan around the genome
- Load local files via drag-and-drop or the File tab
- Load remote files via the URL tab
- Filter features by type or strand
- Highlight regions of interest
- Customize themes and color palettes

---

## Next Steps

Now that you know the basics, explore these topics:

- [Tutorial 2: Exploring Genes](02-exploring-genes.md) - Work with variant data
- [GQL Examples](../GQL-EXAMPLES.md) - More commands to try
- [GQL Manual](../GQL-MANUAL.md) - Complete command reference

---

## Practice Exercise

Try this sequence on your own:

- [ ] Navigate to BRCA1: `search gene BRCA1`
- [ ] Zoom in 3 times
- [ ] Filter to show only exons: `filter type=exon`
- [ ] Pan left to see more of the gene
- [ ] Clear the filter: `clear filters`
- [ ] Highlight a region of interest

Congratulations! You've learned the fundamentals of genome browsing.

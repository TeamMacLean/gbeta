# Tutorial 7: Reading Alignments (BAM/CRAM)

> **Audience**: Anyone analyzing sequencing data (RNA-seq, ChIP-seq, WGS, etc.)
> **Time**: 25-35 minutes
> **Prerequisites**: Basic gBeta navigation, understanding of sequencing concepts
> **Last updated**: Session 23 (2026-01-22)

## What You'll Learn

- Loading BAM and CRAM alignment files (local and remote)
- Understanding the three rendering modes (coverage, blocks, sequence)
- Interpreting CIGAR operations (matches, insertions, deletions)
- Identifying mismatches and variants in your data
- Working with coverage histograms to find interesting regions

---

## BAM vs CRAM: Choosing a Format

Before loading alignment data, it helps to understand the two main formats:

**BAM (Binary Alignment Map)**
- The standard binary format for alignments
- Self-contained - all sequence data stored in the file
- Widely supported by all tools
- Requires an index file (`.bam.bai`) for random access

**CRAM**
- A more compressed version of BAM
- Files are 30-50% smaller than equivalent BAM
- Requires reference sequence to decode reads
- Requires an index file (`.cram.crai`) for random access

> [!TIP]
> Use CRAM when storage and transfer size matter. Use BAM when you need maximum compatibility or don't have reference sequence available.

gBeta supports both formats for local and remote files. For built-in assemblies, gBeta automatically provides the reference sequence needed for CRAM decoding.

---

## Loading Alignment Files

### Loading Local Files

To load BAM or CRAM files from your computer:

1. Click the **File** tab in the sidebar
2. Select your alignment file AND its index file together:
   - For BAM: select both `.bam` and `.bam.bai`
   - For CRAM: select both `.cram` and `.cram.crai`
3. The track appears in the sidebar track list
4. Navigate to a region to see your reads

> [!IMPORTANT]
> You must select both the alignment file and its index at the same time. Without the index, gBeta cannot efficiently fetch reads for specific regions.

### Loading Remote Files

To load BAM or CRAM files from a URL:

1. Click the **URL** tab in the sidebar
2. Paste the URL to your BAM or CRAM file
3. Click **+** to add the track

gBeta automatically looks for the index file at the same URL path (adding `.bai` or `.crai` to the filename). If your index is at a different location, the track will fail to load.

---

## Understanding Zoom-Dependent Rendering

gBeta automatically switches between three rendering modes based on your zoom level. This lets you see the most useful representation of your data at each scale.

> [!IMPORTANT]
> gBeta automatically switches between coverage, block, and sequence rendering based on zoom level. You don't need to change any settings.

### Coverage Mode (Zoomed Out)

**When**: Viewing large regions where each base is less than 1 pixel wide

**What you see**: A coverage histogram showing read depth as an area chart. The Y-axis represents the number of reads covering each position. Areas with high coverage appear as peaks; gaps appear as valleys or flat regions.

**Use for**:
- Getting an overview of coverage across a region
- Finding peaks in ChIP-seq or ATAC-seq data
- Identifying regions with no coverage (deletions, unmapped areas)
- Spotting copy number variations

> [!TIP]
> Start zoomed out to find interesting regions via the coverage histogram, then zoom in for details.

### Block Mode (Medium Zoom)

**When**: Viewing hundreds of bases (approximately 1-8 pixels per base)

**What you see**: Individual reads displayed as gray rectangles. Each rectangle represents one aligned read. CIGAR operations are shown as decorations:
- **Green triangles** mark insertion positions
- **Gaps** in reads indicate deletions
- **Connecting lines** span large gaps (like introns in RNA-seq)

**Use for**:
- Seeing how reads distribute across a region
- Identifying insertions and deletions
- Spotting structural variants
- Examining splice junctions in RNA-seq data

### Sequence Mode (Zoomed In)

**When**: Viewing approximately 50 bases or less (8+ pixels per base)

**What you see**: Actual nucleotide letters for each read, color-coded:
- **A** (blue), **C** (orange), **G** (purple), **T** (teal)
- **Mismatches** are highlighted with a red background
- Read opacity reflects mapping quality (higher quality = more opaque)

**Use for**:
- Verifying SNPs and small variants
- Checking sequence context around variants
- Confirming the exact bases at a position
- Distinguishing real variants from sequencing errors

<details>
<summary>Rendering mode pixel thresholds</summary>

| Mode | Pixels per base | What you see |
|------|-----------------|--------------|
| Coverage | < 1 | Histogram of read depth |
| Block | 1-8 | Read rectangles with CIGAR decorations |
| Sequence | 8+ | Nucleotide letters, mismatches highlighted |

These thresholds ensure you always see the most informative view at your current zoom level.

</details>

---

## Reading CIGAR Strings

CIGAR (Compact Idiosyncratic Gapped Alignment Report) describes how a read aligns to the reference sequence. Understanding CIGAR helps you interpret what gBeta displays.

### Common CIGAR Operations

| Code | Name | What it means | How gBeta shows it |
|------|------|---------------|----------------------|
| M | Match/Mismatch | Base aligned to reference | Normal letter (sequence mode) or block (block mode) |
| I | Insertion | Extra bases in read not in reference | Green triangle marker |
| D | Deletion | Reference bases missing from read | Gap in the read |
| S | Soft clip | Bases present but not aligned | Shown at read ends, usually dimmed |
| N | Skip | Large gap (often an intron) | Long connecting line between blocks |

> [!NOTE]
> Green triangles mark insertions. Gaps in reads indicate deletions.

### Example: Understanding 25M2I23M

Consider a CIGAR string `25M2I23M`. This describes a 50-base read that aligns as follows:

1. **25M**: The first 25 bases match (or mismatch) the reference
2. **2I**: Two extra bases are inserted - they exist in the read but not the reference
3. **23M**: The next 23 bases match the reference

In gBeta:
- **Block mode**: You see a read with a small green triangle at position 25, marking where the insertion occurs
- **Sequence mode**: You see all 50 nucleotides, with the two inserted bases visible at position 25

<details>
<summary>CIGAR Operation Reference</summary>

| Code | Name | Meaning | Visual in gBeta |
|------|------|---------|-------------------|
| M | Match/Mismatch | Aligned to reference | Normal block/letter |
| I | Insertion | Extra bases in read | Green triangle |
| D | Deletion | Missing bases | Gap in read |
| S | Soft clip | Unaligned ends | Shown at read ends |
| N | Skip | Large gap (intron) | Connecting line |
| H | Hard clip | Trimmed from read | Not shown (bases removed) |
| = | Sequence match | Exact match | Same as M |
| X | Sequence mismatch | Explicit mismatch | Same as M |

</details>

---

## Spotting Variants in Alignments

Alignment views are invaluable for validating variants. Here's how to identify different variant types.

### Mismatches (SNPs)

At sequence zoom level, mismatched bases appear with a **red background**. This makes them easy to spot against the normal colored bases.

To evaluate whether a mismatch is a real variant:
- **Many reads show the same mismatch**: Likely a real variant (SNP)
- **Only one or two reads show it**: Possibly a sequencing error
- **Mismatch appears at read ends only**: Often a sequencing artifact

> [!TIP]
> If many reads show the same mismatch, it's likely a real variant. Single-read mismatches may be sequencing errors.

### Insertions

Insertions appear as **green triangle markers** in both block and sequence mode. The triangle points to where the extra bases are inserted.

Signs of a real insertion:
- Multiple reads show the insertion at the same position
- Insertion is consistent across forward and reverse strand reads
- Insertion appears in reads from different parts of the region

### Deletions

Deletions appear as **gaps** in the read. At block mode, you see an empty space where bases would normally be. At sequence mode, you see the reference bases "showing through" the gap.

Signs of a real deletion:
- Multiple reads show a gap at the same position
- Gap is the same size across reads
- Gap appears in reads from both strands

### Large Structural Variants

At block mode, look for:
- **Split reads**: Reads that align to two distant locations
- **Discordant pairs**: Paired reads that map unusually far apart
- **Soft-clipped regions**: Large stretches of unaligned sequence at read ends

These patterns often indicate larger structural variants like translocations, inversions, or large indels.

---

## Try It Yourself

Practice what you've learned with real alignment data.

### Load the Test BAM

1. In the header, select assembly **E. coli K-12 MG1655** from the dropdown
2. Click the **URL** tab in the sidebar
3. Paste this URL:
   ```
   https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.bam
   ```
4. Click **+** to add the track

The track should appear in your track list.

### Explore Rendering Modes

Use the coordinate input or GQL commands to navigate and see all three rendering modes:

**Coverage mode** - View a large region:
```
navigate NC_000913.3:1-500000
```

You should see a coverage histogram showing read depth across half a megabase.

**Block mode** - Zoom to see individual reads:
```
navigate NC_000913.3:100000-100500
```

You should see individual reads as gray rectangles. Look for any insertion markers (green triangles) or deletion gaps.

**Sequence mode** - Zoom to see nucleotides:
```
navigate NC_000913.3:100000-100100
```

You should see colored nucleotide letters (A, C, G, T) for each read. Look for any red-highlighted mismatches.

### Exercise: Find Features

At sequence zoom level:

- [ ] Find a region with high read coverage
- [ ] Look for any mismatched bases (red background)
- [ ] Check if mismatches appear in multiple reads at the same position
- [ ] Look for any insertion markers (green triangles)

<details>
<summary>Hints for finding features</summary>

- Zoom out first to find high-coverage regions
- Zoom into peaks to examine individual reads
- Use the scroll wheel to fine-tune your zoom level
- Real variants typically appear in multiple reads

</details>

### Check Coverage Patterns

Zoom out to coverage mode and examine the histogram:

- [ ] Where is coverage highest? Navigate there to examine reads.
- [ ] Are there any gaps with zero coverage? What might cause them?
- [ ] Is coverage relatively uniform, or are there dramatic peaks and valleys?

---

## Working with CRAM Files

CRAM files offer significant space savings but require reference sequence to decode reads.

### How gBeta Handles CRAM

When you load a CRAM file:

1. gBeta recognizes the CRAM format
2. For built-in assemblies (27+ genomes), gBeta automatically fetches the reference from 2bit files hosted on our servers
3. Reads are decoded using the reference sequence
4. Display is identical to BAM - you see the same three rendering modes

> [!IMPORTANT]
> CRAM files require reference sequence. gBeta auto-fetches from 2bit files for built-in assemblies.

### When to Use CRAM

CRAM is ideal when:
- Working with large datasets where storage matters
- Sharing data with collaborators (smaller transfers)
- Long-term archiving of alignment data
- Your organism has a good reference assembly

### Limitations

> [!WARNING]
> For custom assemblies not in gBeta's built-in list, CRAM decoding requires you to provide a 2bit reference file.

Other considerations:
- CRAM files may load slightly slower than BAM (reference fetch adds time)
- Some older CRAM versions may have compatibility issues
- Custom assemblies need their 2bit reference hosted at an accessible URL

---

## Tips and Best Practices

**Start zoomed out**: Use coverage view to find interesting regions before zooming in. This is much faster than scrolling through reads.

**Use coverage peaks**: In ChIP-seq, ATAC-seq, or similar data, peaks in coverage indicate enriched regions. Navigate to peaks for detailed examination.

**Verify variants at sequence level**: Never trust a variant call without visual inspection. Zoom to sequence mode to see the actual bases.

**Check both strands**: Real variants typically appear in reads from both forward and reverse strands. Strand-specific artifacts are often errors.

**Consider mapping quality**: gBeta shows higher mapping quality reads with more opacity. Faded reads are less reliably mapped.

**Compare to known genes**: Load a gene annotation track alongside your alignments. This helps interpret variants in genomic context.

---

## Summary

You now know how to:

- **Load alignment files**: Both BAM and CRAM, from local files or URLs
- **Navigate rendering modes**: Coverage (overview), block (reads), sequence (bases)
- **Read CIGAR strings**: M (match), I (insertion), D (deletion), N (skip), S (soft clip)
- **Identify variants**: Mismatches (red background), insertions (green triangles), deletions (gaps)
- **Use coverage histograms**: Find peaks, gaps, and regions of interest
- **Work with CRAM**: Understand reference requirements and automatic fetching

Alignment visualization is essential for validating variants, examining splice junctions, checking coverage, and understanding your sequencing data at the deepest level.

---

## Next Steps

- **Tutorial 6: Remote Tracks** - Learn more about loading indexed remote files
- **Tutorial 8: Customizing Themes** - Adjust colors for better visibility of alignment features
- Explore GQL commands like `FILTER` to focus on specific read characteristics

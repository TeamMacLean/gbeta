# Tutorial 6: Loading Remote Tracks

> **Audience**: Anyone working with large genomic datasets or shared data repositories
> **Time**: 15-20 minutes
> **Prerequisites**: Basic gBeta navigation ([Tutorial 1](01-getting-started.md))
> **Last updated**: Session 23 (2026-01-22)

## What You'll Learn

- Loading data directly from URLs (no download required)
- Supported remote formats (BigBed, BigWig, BAM, tabix)
- Understanding index files and auto-discovery
- Working with public data repositories
- CORS requirements for self-hosted data

---

## Why Remote Tracks?

Traditional genome browsers require you to download files before viewing them. For small annotation files, that works fine. But genomic data can be enormous - a single BAM file might be tens of gigabytes.

gBeta supports **remote track loading**, which means you can view data directly from a URL without downloading the entire file. Here's why this matters:

**Efficiency**: gBeta only fetches the data for your current viewport. If you're looking at a 10kb region of chromosome 17, it doesn't need to download the other 99.99% of the genome.

**No storage required**: You don't need disk space for multi-gigabyte files. The data stays on the server.

**Easy sharing**: Want a colleague to see the same data? Send them the URL. No need to transfer files.

**Works with public repositories**: Load data directly from UCSC, Ensembl, ENCODE, or any server with public URLs.

> [!TIP]
> Remote loading only fetches data for the current viewport - perfect for huge files.

---

## Supported Indexed Formats

Remote loading requires **indexed** formats that allow efficient random access to specific genomic regions. These same formats also work for local files - just drag and drop the data file along with its index.

> [!NOTE]
> All formats listed here work both remotely (via URL) and locally (via drag and drop).

| Format | Extensions | Index | Description |
|--------|------------|-------|-------------|
| BigBed | .bb, .bigbed | Built-in | Indexed intervals (BED data) |
| BigWig | .bw, .bigwig | Built-in | Indexed signal/coverage data |
| BAM | .bam | .bam.bai | Aligned sequencing reads |
| CRAM | .cram | .cram.crai | Compressed alignments |
| VCF | .vcf.gz | .vcf.gz.tbi | Tabix-indexed variants |
| GFF | .gff.gz, .gff3.gz | .tbi | Tabix-indexed annotations |
| BED | .bed.gz | .bed.gz.tbi | Tabix-indexed intervals |

> [!TIP]
> BigBed and BigWig files are self-indexed - no separate index file needed.

### Index Files

Indexed formats fall into two categories:

**Self-indexed formats** (BigBed, BigWig): The index is embedded in the file itself. You only need the single file.

**External index formats** (BAM, CRAM, tabix): These require a separate index file. The index must be at a predictable URL relative to the data file:

- `example.bam` needs `example.bam.bai`
- `example.vcf.gz` needs `example.vcf.gz.tbi`
- `example.gff3.gz` needs `example.gff3.gz.tbi`

> [!IMPORTANT]
> Index files must be at the same URL path: `file.bam` needs `file.bam.bai` alongside it.

gBeta automatically looks for index files at the expected location. You only need to provide the URL to the data file.

---

## How to Load a Remote Track

Loading a remote track takes just a few clicks:

1. Click the **URL** tab in the sidebar (under Add Tracks)
2. Paste the URL to your data file in the text input
3. Click the **+** button (or press Enter)
4. Wait for the track to load

The track appears in your track list once loaded. gBeta automatically detects the format from the file extension and fetches data for your current viewport.

---

## Try It Yourself

Let's practice loading remote tracks with real data.

### Exercise 1: Load a BigWig Conservation Track

Conservation scores show how similar a region is across species - highly conserved regions are often functionally important.

- [ ] Select assembly **GRCh38** from the dropdown in the header
- [ ] Click the **URL** tab in the sidebar
- [ ] Paste this URL:
  ```
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/hg38.phyloP100way.bw
  ```
- [ ] Click the **+** button
- [ ] Navigate to `chr17:7668421-7687490` (the TP53 tumor suppressor gene)
- [ ] Observe the conservation signal - exons show high conservation (tall peaks)

<details>
<summary>What you should see</summary>

The BigWig track displays as a continuous signal graph. In the TP53 region, you'll notice:
- High peaks (strong conservation) over the exons
- Lower signal in introns
- The pattern reflects that coding sequences are under strong evolutionary constraint

</details>

### Exercise 2: Load E. coli Test Files

Let's load multiple formats for the same organism to see how different data types complement each other.

- [ ] Select assembly **E. coli K-12 MG1655** from the dropdown
- [ ] Navigate to `NC_000913.3:100000-110000`

Now load each of these tracks via the **URL** tab:

**GFF (gene annotations)**:
```
https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.gff3.gz
```

**VCF (variants)**:
```
https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.vcf.gz
```

**BAM (alignments)**:
```
https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.bam
```

<details>
<summary>What you should see</summary>

With all three tracks loaded, you can see:
- **GFF track**: Gene models showing coding regions
- **VCF track**: Variant positions marked along the chromosome
- **BAM track**: Individual read alignments (zoom in) or coverage histogram (zoom out)

This layered view lets you correlate variants with gene annotations and see actual read support.

</details>

---

## Working with Public Repositories

Many organizations host genomic data that you can load directly into gBeta:

**UCSC Genome Browser**: Extensive collection of annotation tracks
- Base URL: `https://hgdownload.soe.ucsc.edu/goldenPath/`
- Example: Conservation, repeats, regulation tracks

**Ensembl**: Gene annotations and variation data
- Check their FTP site for BigBed/BigWig files

**ENCODE**: Thousands of functional genomics experiments
- Many datasets available as BigWig signal tracks

**Your institution**: If your lab or institution hosts data on a web server, you can load it directly (if CORS-enabled - see below)

> [!NOTE]
> Public repositories like UCSC and Ensembl are already CORS-enabled.

---

## CORS Requirements

When loading data from a URL, your browser enforces security rules called CORS (Cross-Origin Resource Sharing). This prevents websites from accessing data they shouldn't.

For remote tracks to work, the server hosting the data must include a header that permits access:

```
Access-Control-Allow-Origin: *
```

**Good news**: Most public genomics repositories already have this configured. UCSC, Ensembl, and similar resources work out of the box.

**If you're hosting your own data**: You'll need to configure CORS on your server.

> [!WARNING]
> Remote URLs must be CORS-enabled. If you get errors loading a URL, check the server's CORS configuration.

<details>
<summary>Setting up CORS for your own server</summary>

**Cloudflare R2**:
Public buckets have CORS enabled by default. No configuration needed.

**AWS S3**:
Add a CORS configuration to your bucket:
```json
{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"]
  }]
}
```

**nginx**:
Add this to your server configuration:
```
add_header Access-Control-Allow-Origin *;
```

**Apache**:
Add this to your .htaccess or server config:
```
Header set Access-Control-Allow-Origin "*"
```

</details>

---

## Troubleshooting

### "Failed to load track"

**Check the URL is accessible**: Try opening the URL directly in your browser. If you can't access it, gBeta can't either.

**Check CORS**: Open your browser's developer console (F12) and look for CORS errors. If you see "blocked by CORS policy", the server needs CORS headers.

**Check the format**: Make sure the file extension matches a supported format (.bw, .bb, .bam, etc.).

### "Index not found"

For BAM and tabix files, gBeta looks for the index at the expected location:
- `file.bam` + `file.bam.bai`
- `file.vcf.gz` + `file.vcf.gz.tbi`

Ensure the index file exists at that exact path. Some servers use `.bai` without the `.bam` prefix - gBeta expects `file.bam.bai`.

### "No features visible"

**Check chromosome names**: If the data uses different chromosome naming than the assembly (e.g., `chr1` vs `1`), features won't display. Load the data with a compatible assembly or check the data source's documentation.

**Navigate to a region with data**: Some datasets only cover specific regions. Try navigating to a known location with data.

### "Track loads but appears empty"

**Zoom in**: Some tracks (especially BAM) show different views at different zoom levels. Coverage histograms appear when zoomed out; individual reads appear when zoomed in.

**Check the viewport**: Make sure you're viewing a chromosome that exists in the data.

---

## Summary

You've learned how to:

- Load genomic data directly from URLs without downloading files
- Identify which formats support remote loading (BigBed, BigWig, BAM, tabix-indexed files)
- Understand index file requirements and auto-discovery
- Find and use data from public repositories
- Configure CORS for self-hosted data
- Troubleshoot common loading issues

Remote track loading is one of gBeta's most powerful features. It lets you work with massive datasets efficiently and share views with collaborators instantly.

---

## Next Steps

- **[Tutorial 7: Reading Alignments](07-reading-alignments.md)**: Dive deeper into BAM/CRAM visualization
- **[Tutorial 8: Customizing Themes](08-customizing-themes.md)**: Adjust colors and contrast for your preferences
- Explore public data repositories and load tracks that are relevant to your research

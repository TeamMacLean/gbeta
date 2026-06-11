# Loading Remote Tracks from URLs

gBeta supports loading genomic data tracks directly from URLs. This allows you to visualize data hosted on remote servers without downloading files locally.

## Quick Start

1. Click the **URL** tab in the sidebar (next to "File")
2. Paste a URL to an indexed genomic file
3. Click **+** to add the track
4. Navigate to a region with data to see features

## Supported Formats

| Extension | Format | Description |
|-----------|--------|-------------|
| `.bb`, `.bigbed` | BigBed | Indexed BED intervals |
| `.bw`, `.bigwig` | BigWig | Indexed signal/coverage data |
| `.vcf.gz` | VCF (tabix) | Indexed variant calls |
| `.gff.gz`, `.gff3.gz` | GFF (tabix) | Indexed gene annotations |
| `.bed.gz` | BED (tabix) | Indexed intervals |
| `.bam` | BAM | Indexed read alignments |
| `.cram` | CRAM | Compressed alignments (partial support) |

## Format Details

### BigBed & BigWig

These formats have a built-in index, so only one file is needed:

```
https://example.com/mydata.bb
https://example.com/coverage.bw
```

### Tabix Formats (VCF, GFF, BED)

Tabix-indexed files require a companion `.tbi` index file at the same URL path:

```
Data file:  https://example.com/variants.vcf.gz
Index file: https://example.com/variants.vcf.gz.tbi  (required)
```

gBeta automatically looks for the index file by appending `.tbi` to the data URL.

### BAM/CRAM (Alignments)

BAM files require a companion `.bai` index file:

```
Data file:  https://example.com/alignments.bam
Index file: https://example.com/alignments.bam.bai  (required)
```

gBeta automatically looks for the index file by appending `.bai` to the data URL.

**Note**: CRAM support is partial. CRAM files require a reference sequence for decoding, which is not yet implemented. Use BAM files for best results.

## Requirements

### CORS

Remote URLs must allow cross-origin requests (CORS). Most public data repositories support this. If you're hosting your own files:

**Cloudflare R2**: CORS is enabled by default on public buckets.

**AWS S3**: Add this CORS configuration to your bucket:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["Content-Range", "Content-Length"]
  }
]
```

**Your own server**: Add these response headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Expose-Headers: Content-Range, Content-Length
```

### Byte-Range Support

Remote files must support HTTP Range requests for efficient region-based queries. Most cloud storage services (S3, R2, GCS) support this by default.

## Creating Your Own Files

### BigBed/BigWig

Use UCSC tools (`bedToBigBed`, `wigToBigWig`, `bedGraphToBigWig`):

```bash
# BED to BigBed
bedToBigBed input.bed chrom.sizes output.bb

# bedGraph to BigWig
bedGraphToBigWig input.bedgraph chrom.sizes output.bw
```

### Tabix Files

Use `bgzip` and `tabix` from htslib:

```bash
# Install (macOS)
brew install htslib

# Install (Ubuntu/Debian)
apt install tabix

# VCF
bgzip myfile.vcf
tabix -p vcf myfile.vcf.gz

# GFF (must be sorted)
sort -k1,1 -k4,4n myfile.gff3 > sorted.gff3
bgzip sorted.gff3
tabix -p gff sorted.gff3.gz

# BED (must be sorted)
sort -k1,1 -k2,2n myfile.bed > sorted.bed
bgzip sorted.bed
tabix -p bed sorted.bed.gz
```

**Important**: Files must be sorted by chromosome and position before indexing!

## Test URLs

Try these test files to verify URL loading works:

**Assembly**: E. coli K-12 MG1655
**Region**: `NC_000913.3:100000-300000`

| Format | URL |
|--------|-----|
| VCF | `https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.vcf.gz` |
| GFF | `https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.gff3.gz` |
| BED | `https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.bed.gz` |

## Troubleshooting

### "Failed to fetch" or network error

- Check that the URL is accessible in your browser
- Verify the server has CORS enabled
- Check that both data file AND index file exist (for tabix formats)

### No features displayed

- Navigate to a region that contains data
- Check the chromosome name matches your assembly
- Verify the file contains data for the current chromosome

### "Unsupported format" error

- Check the file extension matches a supported format
- URLs must end with a recognized extension (`.bb`, `.bw`, `.vcf.gz`, etc.)

### Slow loading

- Large regions may take time to load
- Try zooming in to a smaller region
- Check your network connection

# Gene Track Hosting

gBeta automatically loads gene annotations for supported genomes. This document explains how gene tracks work and how to add support for new genomes.

## How It Works

When you select a genome assembly, gBeta checks if there's a known gene annotation source for that genome. If found, it loads genes on-demand as you navigate, fetching only the data needed for the current viewport via HTTP Range requests.

## Understanding the Tracks

gBeta can display two types of annotation tracks: **Genes** and **Transcripts**. Not all assemblies have both.

### Genes Track

The Genes track shows **gene-level** annotations:

- **One feature per gene** (e.g., TP53, BRCA1, AT1G01010)
- **Simple rectangle** spanning the full gene extent
- **No internal structure** - just the gene boundaries
- **Best for**: Getting an overview, seeing gene density, identifying gene locations

```
Gene: TP53
├──────────────────────────────────────────┤
        (single continuous feature)
```

### Transcripts Track

The Transcripts track shows **transcript-level** annotations:

- **One feature per transcript isoform** (e.g., ENST00000413465.6)
- **Compound structure** with exon blocks connected by intron lines
- **Shows splicing patterns** - thick boxes for exons, thin lines for introns
- **Multiple isoforms per gene** due to alternative splicing
- **Best for**: Detailed gene structure, understanding splicing, isoform analysis

```
Transcript: ENST00000413465.6 (TP53)
█───█──█────█───────█──█─────█
 (exons connected by intron lines)
```

### Which Assemblies Have Which Tracks?

| Assembly | Genes | Transcripts | Source |
|----------|:-----:|:-----------:|--------|
| **Human** (GRCh38, hg38, hg19) | ❌ | ✅ | UCSC knownGene |
| **Human T2T** (T2T-CHM13) | ❌ | ✅ | UCSC CAT/LiftOff |
| **Mouse** (mm39, mm10) | ❌ | ✅ | UCSC/GenArk |
| **Zebrafish** (danRer11) | ❌ | ✅ | GenArk RefSeq |
| **Fly** (dm6) | ❌ | ✅ | GenArk RefSeq |
| **Worm** (ce11) | ❌ | ✅ | GenArk RefSeq |
| **Yeast** (sacCer3) | ❌ | ✅ | GenArk RefSeq |
| **Rat** (rn7) | ❌ | ✅ | GenArk RefSeq |
| **Chicken** (galGal6) | ❌ | ✅ | GenArk RefSeq |
| **Arabidopsis** (TAIR10) | ✅ | ✅ | R2-hosted |
| **Rice** (IRGSP-1.0) | ✅ | ✅ | R2-hosted |
| **Wheat** (IWGSC RefSeq v2) | ✅ | ✅ | R2-hosted |
| **Barley** (Morex v3) | ✅ | ✅ | R2-hosted |
| **Maize** (B73 NAM5) | ✅ | ✅ | R2-hosted |
| **S. pombe** | ✅ | ✅ | R2-hosted |
| **Botrytis cinerea** | ✅ | ✅ | R2-hosted |
| **Magnaporthe oryzae** | ✅ | ✅ | R2-hosted |
| **Puccinia graminis** | ✅ | ✅ | R2-hosted |
| **Zymoseptoria tritici** | ✅ | ✅ | R2-hosted |
| **Phytophthora infestans** | ✅ | ✅ | R2-hosted |
| **E. coli K-12** | ✅ | ❌ | R2-hosted (no splicing) |
| **SARS-CoV-2** | ✅ | ❌ | R2-hosted (no splicing) |

**Note**: Assemblies with only a Transcripts track use UCSC/GenArk data which contains transcript models with exon structure, not collapsed gene features. The gene symbol (like "TP53") is metadata on each transcript, not a separate feature.

## Gene Track Sources

| Source | Genomes | Notes |
|--------|---------|-------|
| **UCSC** | Human (hg38, hg19, mm10) | Official UCSC Known Genes / GENCODE |
| **UCSC CAT/LiftOff** | Human T2T-CHM13 | Gene annotations lifted from GRCh38 |
| **GenArk** | Mouse (mm39), Zebrafish, Fly, Worm, Yeast, Rat, Chicken | NCBI RefSeq annotations via UCSC GenArk hubs |
| **Self-hosted (R2)** | Plants, Fungi, Bacteria, Viruses | Converted from Ensembl/NCBI GFF3 |

## Adding New Genomes

If you want to add gene track support for a genome not listed above:

### Option 1: Find an existing BigBed file

Check if UCSC or GenArk already has a BigBed file:
- UCSC gbdb: `https://hgdownload.soe.ucsc.edu/gbdb/{assembly}/`
- GenArk hubs: `https://hgdownload.soe.ucsc.edu/hubs/`

If found, add the URL to `src/lib/services/bigbed.ts` in the `GENE_BIGBED_URLS` object.

### Option 2: Convert from GFF3

For genomes with GFF3 annotations (Ensembl, NCBI, etc.), use our conversion pipeline:

1. **Add genome config** to `scripts/gene-tracks/genomes.json`
2. **Run conversion**: `python scripts/gene-tracks/convert_gffutils.py <genome_id>`
3. **Upload to R2**: `./scripts/gene-tracks/upload-r2.sh <genome_id>`
4. **Add URL** to `src/lib/services/bigbed.ts`

See [`scripts/gene-tracks/README.md`](../scripts/gene-tracks/README.md) for complete setup instructions including Cloudflare R2 configuration.

## Chromosome Name Mapping

Different data sources use different chromosome naming conventions:
- **UCSC**: `chr1`, `chr2`, `chrX`
- **Ensembl**: `1`, `2`, `X`
- **NCBI**: `NC_000001.11`, `NC_000002.12`

gBeta automatically maps between conventions. If your BigBed file uses non-standard names, add a mapping in `GENE_BIGBED_CHROMOSOME_MAP` in `src/lib/services/bigbed.ts`.

## Technical Details

- **Format**: BigBed (indexed binary BED)
- **Library**: `@gmod/bbi` for parsing
- **Transport**: HTTP Range requests (no full download)
- **Caching**: 5-minute in-memory cache per region

## File Locations

- `src/lib/services/bigbed.ts` - BigBed service, URL mappings
- `src/lib/stores/remoteTracks.svelte.ts` - Track state management
- `scripts/gene-tracks/` - GFF3 → BigBed conversion pipeline

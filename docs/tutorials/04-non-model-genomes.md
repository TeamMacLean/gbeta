# Tutorial 4: Non-Model Genomes

> **Audience**: Domain experts working with any organism
> **Time**: 20-30 minutes
> **Prerequisites**: Basic gBeta navigation ([Tutorial 1](01-getting-started.md))
> **Last updated**: Session 23 (2026-01-22)

gBeta is species-agnostic. Whether you study wheat pathogens, fruit flies, or marine bacteria, this tutorial shows you how to work with custom genome assemblies and non-standard chromosome names.

## What You'll Learn

- Selecting from 27+ built-in genome assemblies
- Understanding the taxonomic assembly organization
- Loading custom chromosome sizes for unlisted genomes
- Handling chromosome name mismatches
- Working with non-standard naming conventions

## Scenario

You're a plant pathologist studying *Zymoseptoria tritici*, a fungal wheat pathogen. Your genome has chromosomes named differently than human (e.g., `chromosome_7` instead of `chr7`), and you have custom gene annotations.

---

## Step 1: Understanding Assemblies

A genome assembly defines:
- Which chromosomes exist
- How long each chromosome is
- The chromosome naming convention

### Human assemblies

Most examples use human:
- **GRCh38** (hg38) - Current standard
- **GRCh37** (hg19) - Legacy, still common
- **T2T-CHM13** - Complete telomere-to-telomere assembly

### Non-human assemblies

> [!NOTE]
> gBeta includes 27+ built-in assemblies. Check the dropdown before loading custom chromosome sizes.

gBeta supports many organisms across all kingdoms of life, organized taxonomically in the assembly dropdown.

---

## Step 2: Selecting an Assembly

### Using the assembly dropdown

1. Click the assembly button in the header (shows current assembly name)
2. The dropdown opens with assemblies organized by **taxonomic category**
3. Browse categories or scroll to find your organism
4. Click to select

### Built-in assemblies (27+)

gBeta includes assemblies organized by category:

| Category | Assemblies |
|----------|------------|
| **Animals** | |
| Human | GRCh38 (hg38), GRCh37 (hg19), T2T-CHM13 |
| Mouse | mm39, mm10 |
| Other vertebrates | Zebrafish (danRer11), Rat (rn7), Chicken (galGal6) |
| Invertebrates | Fly (dm6), Worm (ce11) |
| **Plants** | |
| Model plants | Arabidopsis (TAIR10) |
| Crops | Rice (IRGSP-1.0), Maize (Zm-B73-v5), Wheat (IWGSC), Barley (MorexV3) |
| **Fungi** | |
| Model fungi | S. pombe, S. cerevisiae (sacCer3) |
| Plant pathogens | Botrytis cinerea, Magnaporthe oryzae, Puccinia, Zymoseptoria tritici |
| **Protists** | |
| Oomycetes | Phytophthora infestans |
| **Bacteria** | |
| Model bacteria | E. coli K-12 MG1655 |
| **Viruses** | |
| Coronaviruses | SARS-CoV-2 |

### Automatic gene tracks

> [!NOTE]
> For most built-in assemblies, gene tracks load automatically.

For most assemblies, gene/transcript tracks load automatically:
- **UCSC assemblies** (human, mouse, etc.): Transcript tracks from knownGene
- **Plant/fungal assemblies**: Gene and transcript tracks from R2 storage

If your assembly has automatic tracks, you'll see them in the sidebar after selection.

### After selecting an assembly

When you select a new assembly:
1. **Chromosome dropdown updates** - Shows chromosomes for that genome
2. **Gene tracks load** - Automatic tracks appear (if available for that assembly)
3. **Reference sequence available** - Nucleotides display at high zoom
4. **View resets** - Navigates to a default position on the first chromosome

---

## Step 3: Custom Assemblies

If your organism isn't listed, you have options.

### Option A: Infer from data

Load your data file first, and gBeta will offer to create an assembly from the chromosomes it finds.

1. Load your GFF3 or BED file
2. If chromosomes don't match, a dialog appears
3. Choose "Infer from data"
4. gBeta creates an assembly from your file

### Option B: Load chrom.sizes

A `chrom.sizes` file lists chromosome names and lengths:

```
chromosome_1    6150000
chromosome_2    3870000
chromosome_3    3700000
chromosome_4    2580000
chromosome_5    1820000
chromosome_6    1730000
chromosome_7    1450000
```

To use it:

1. Click "Load Assembly" in assembly dropdown
2. Select your `.chrom.sizes` file
3. The assembly is created automatically

### Creating a chrom.sizes file

If you have a FASTA file:

```bash
# Using samtools
samtools faidx genome.fasta
cut -f1,2 genome.fasta.fai > genome.chrom.sizes
```

Or manually create one in any text editor.

---

## Step 4: Chromosome Name Conventions

Different genomes use different naming conventions.

> [!WARNING]
> Chromosome names are case-sensitive. `Chr1` and `chr1` are different!

### Common patterns

| Organism | Convention | Example |
|----------|------------|---------|
| Human | chr prefix | chr1, chr2, chrX |
| Some bacteria | No prefix | 1, 2, plasmid |
| Fungi | Descriptive | chromosome_1, chromosome_7 |
| Plants | Variable | Chr1, chr1, 1, scaffold_123 |

### Handling mismatches

If your data uses different names than the assembly:

**Your file**: `1, 2, 3, X, Y`
**Assembly expects**: `chr1, chr2, chr3, chrX, chrY`

gBeta will warn you and offer to:
1. **Infer assembly** - Create new assembly from your data
2. **Continue anyway** - Hope for partial matches

> [!CAUTION]
> If chromosomes don't match, features won't display. Always verify after loading.

---

## Step 5: Working with Your Data

Once the assembly matches, everything works normally.

### Load your annotations

```
# Drag and drop your GFF3 file
```

### Navigate to a chromosome

```
navigate chromosome_7:1-500000
```

Or use the chromosome dropdown.

### Search for genes

If your GFF3 has gene names:

```
# Gene search works with any name in your data
search gene ZtEFFECTOR1
```

---

## Step 6: Verifying Data Alignment

Always verify your data loaded correctly.

### Check chromosome coverage

After loading, navigate to different chromosomes:

```
navigate chromosome_1:1-100000
navigate chromosome_7:1-100000
```

Features should appear if your assembly matches.

### Check coordinate ranges

Your features should fit within chromosome boundaries:
- Feature at position 5,000,000 won't display if chromosome is only 3,000,000 bp

### Visual sanity check

- Gene models should have sensible sizes
- Exons should be smaller than genes
- No features outside chromosome bounds

---

## Step 7: Multiple Tracks with Custom Assembly

Once you have a working assembly, add more tracks.

> [!IMPORTANT]
> All your data files must use the **same** chromosome naming convention.

### Consistent chromosome names

All your files must use the **same** chromosome naming:

```
# All files should match:
genes.gff3:    chromosome_7  ...
variants.vcf:  chromosome_7  ...
peaks.bed:     chromosome_7  ...
```

### Loading additional tracks

Just drag and drop. gBeta uses your current assembly for all tracks.

---

## Organism-Specific Tips

<details>
<summary>Tips for bacterial genomes</summary>

- Usually single circular chromosome
- Plasmids as separate sequences
- Often no "chr" prefix
- Gene density is high - zoom out to see patterns

Example navigation:
```
navigate chromosome:1-1000000
navigate plasmid_pABC:1-50000
```

</details>

<details>
<summary>Tips for fungal genomes</summary>

Fungal genomes vary widely:
- Core chromosomes
- Accessory chromosomes
- Unusual naming schemes

Example navigation:
```
navigate chr7:1-1000000
navigate chr_dispensable_1:1-500000
```

</details>

<details>
<summary>Tips for plant genomes</summary>

- Can be large with many scaffolds
- May have organelle genomes (chloroplast, mitochondria)
- Naming varies: Chr1, chr1, 1, scaffold_123
- Check assembly documentation for conventions

Example navigation:
```
navigate Chr1:1-10000000
navigate scaffold_123:1-50000
navigate chloroplast:1-150000
```

</details>

---

## Troubleshooting

### "No features visible"

1. Check chromosome names match between assembly and data
2. Verify coordinate ranges are valid
3. Try navigating to a specific position you know has data

### "Chromosome not found"

The chromosome in your navigation doesn't exist in the assembly:
- Check spelling (case-sensitive!)
- Verify the assembly was loaded correctly
- List available chromosomes in the dropdown

### "Gene track is empty"

Some assemblies have automatic gene tracks, others don't:
- Check the sidebar for "Transcripts" or "Genes" tracks
- If missing, you need to load your own GFF3 annotations
- Bacterial assemblies may only show CDS, not full gene models

### "Features extend beyond chromosome"

Your features have coordinates larger than the chromosome length:
- Verify your chrom.sizes file is correct
- Check you're using the right genome version

### Tracks don't align

Different tracks use different chromosome names:
- Standardize names in your files
- Or load each file and infer separate assemblies

---

## Try It Yourself

### Explore E. coli (bacteria)

1. Select **E. coli K-12 MG1655** from the assembly dropdown (under Bacteria)
2. Notice the chromosome name: `NC_000913.3` (RefSeq accession)
3. Gene tracks load automatically
4. Navigate:
   ```
   navigate NC_000913.3:100000-110000
   ```
5. Zoom in to see gene structures

### Explore Arabidopsis (plant)

1. Select **TAIR10 (Arabidopsis)** from the dropdown (under Plants)
2. Notice chromosomes are named: `Chr1`, `Chr2`, etc.
3. Both Genes and Transcripts tracks load
4. Navigate:
   ```
   navigate Chr1:1000000-1100000
   ```

### Load custom data for Zymoseptoria

If you work with *Z. tritici*:

1. Select **Zymoseptoria tritici** from dropdown (under Fungi > Plant pathogens)
2. Gene tracks load automatically
3. Load your own VCF/BED/GFF files
4. Navigate using the chromosome names: `chr_1`, `chr_2`, etc.

---

## Summary

You now know how to:
- Select from 27+ built-in assemblies organized by taxonomy
- Understand that most assemblies include automatic gene tracks
- Load custom chromosome sizes for unlisted genomes
- Handle chromosome name mismatches between files
- Verify data alignment after loading

---

## Next Steps

- [Tutorial 5: Reproducible Analysis](05-reproducible-analysis.md) - Save and share your work
- [GQL Manual](../GQL-MANUAL.md) - Complete query reference
- [GQL Examples](../GQL-EXAMPLES.md) - More query patterns

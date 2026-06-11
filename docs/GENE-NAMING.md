# Gene Naming Conventions

This document describes how gBeta extracts and displays gene identifiers from different annotation sources.

## Terminology

- **Locus ID**: Systematic identifier assigned by the annotation consortium (e.g., AT1G01010, MGG_01947, b0001)
- **Gene Symbol/Name**: Human-readable gene name (e.g., NAC001, rbcS, thrL)

Most users want to **see** gene symbols when available, but need to **search** by either.

## Source Analysis

### Ensembl Plants (Arabidopsis, Rice, Maize, Wheat, Barley)

**GFF3 Structure:**
```
gene:   ID=gene:AT1G01010;Name=NAC001;biotype=protein_coding
mRNA:   ID=transcript:AT1G01010.1;Parent=gene:AT1G01010;Name=NAC001-201
```

**Available attributes:**
| Attribute | Example | Type |
|-----------|---------|------|
| `Name` (on gene) | NAC001 | Gene symbol |
| `ID` (on gene) | gene:AT1G01010 | Locus ID (prefixed) |
| `gene_id` (on gene) | AT1G01010 | Locus ID (clean) |

**Strategy:** Use `Name` for display (gene symbol), fall back to `gene_id` (locus ID) if no Name.

### Ensembl Fungi (S. pombe, Botrytis, Magnaporthe, Puccinia, Zymoseptoria)

**GFF3 Structure varies by organism:**

**S. pombe (PomBase - well-annotated):**
```
gene:   ID=gene:SPBC460.03;Name=vba2;biotype=protein_coding
```
- Has both systematic ID and gene symbol for many genes

**Magnaporthe (Broad - minimal annotation):**
```
gene:   ID=gene:MGG_01947;gene_id=MGG_01947;biotype=protein_coding
```
- NO `Name` attribute - only has systematic locus IDs

**Botrytis (good annotation):**
```
gene:   ID=gene:Bcin01g00010;Name=Bcboa1;biotype=protein_coding
```
- Has both locus ID and gene symbol

**Strategy:** Use `Name` if available, fall back to `gene_id` (extract from ID if needed).

### Ensembl Protists (Phytophthora)

**GFF3 Structure:**
```
gene:   ID=gene:PITG_00002;gene_id=PITG_00002;description=...
```

**Strategy:** Use `gene_id` (no gene symbols available).

### NCBI RefSeq (E. coli, SARS-CoV-2)

**GFF3 Structure:**
```
gene:   ID=gene-b0001;gene=thrL;locus_tag=b0001;Name=thrL
CDS:    gene=thrL;locus_tag=b0001
```

**Available attributes:**
| Attribute | Example | Type |
|-----------|---------|------|
| `gene` | thrL | Gene symbol |
| `locus_tag` | b0001 | Locus ID |
| `Name` | thrL | Gene symbol (same as gene) |

**Strategy:** Use `gene` or `Name` for display (gene symbol), `locus_tag` for systematic ID.

## Conversion Strategy

### Priority Order for Display Name

1. `Name` (Ensembl gene symbol, NCBI gene name)
2. `gene` (NCBI gene attribute)
3. `gene_id` (Ensembl systematic ID)
4. Extract from `ID` (e.g., "gene:AT1G01010" → "AT1G01010")

### Actual Results per Genome

| Genome | Source | Display Format | Example Labels |
|--------|--------|----------------|----------------|
| tair10 | Ensembl Plants | Gene symbol (transcript) | NAC001-201, ARV1-202 |
| irgsp1 | Ensembl Plants | Gene symbol (transcript) | Gene symbols when available |
| iwgsc-refseq2 | Ensembl Plants | Transcript ID | TraesCS1A03G0000200 (no symbols) |
| morex-v3 | Ensembl Plants | Transcript ID | HORVU.MOREX.r3.* |
| zm-b73-nam5 | Ensembl Plants | Transcript ID | Zm00001eb000010_T001 |
| spombe | Ensembl Fungi | Mixed | tlh1 (symbol) or SPAC212.08c.1 (locus) |
| botrytis | Ensembl Fungi | Gene symbol | Bcboa1, Bcboa2, etc. |
| magnaporthe | Ensembl Fungi | Locus ID | MGG_01947T0 (no symbols available) |
| puccinia | Ensembl Fungi | Locus ID | PGTG_20568 (no symbols) |
| zymoseptoria | Ensembl Fungi | Locus ID | Mycgr3G32211 (no symbols) |
| phytophthora | Ensembl Protists | Locus ID | PITG_00002 (no symbols) |
| ecoli-k12 | NCBI RefSeq | Gene symbol | thrL, thrA, thrB, etc. |
| sars-cov-2 | NCBI RefSeq | Gene symbol | S, ORF1ab, ORF3a, etc. |

## Implementation

The conversion script should:

1. Try `Name` attribute first (gives gene symbol when available)
2. Fall back to `gene` (for NCBI sources)
3. Fall back to `gene_id` (for systematic ID)
4. Extract clean ID from `ID` attribute as last resort

This ensures we always show SOMETHING meaningful, preferring human-readable symbols when available.

## Future: Dual Display

Consider showing both in the UI:
- **Primary label**: Gene symbol (when available) or locus ID
- **Tooltip/detail**: Both symbol AND locus ID

This would help users who know genes by either identifier.

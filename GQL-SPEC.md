# gBeta Query Language (GQL) Specification

**Version:** 0.1.0
**Status:** Phase 1 implemented (core navigation, SELECT, INTERSECT, WITHIN, COUNT)
**Date:** 2026-01-09
**Updated:** Session 2 - added scope clarification rules, IN CHROMOSOME keyword

## Overview

GQL is a domain-specific query language for genome browser operations. It serves as the contract between:
- **Natural language input** (translated by AI)
- **Execution engines** (local, indexed files, remote APIs)
- **User reproducibility** (visible, editable, shareable)

### Design Principles

1. **Human-readable** - Scientists should understand queries without training
2. **AI-friendly** - Simple enough for LLMs to generate reliably
3. **Backend-agnostic** - Same query works on local data or petabyte databases
4. **Composable** - Queries can be chained with pipes
5. **Reproducible** - Queries fully specify the operation (no hidden state)

---

## Data Model

### Core Concepts

```
TRACK      A data source (file, URL, database table)
           Examples: "genes.gff3", "clinvar.vcf", "encode:H3K27ac"

FEATURE    A genomic entity with coordinates
           Required: chromosome, start, end
           Optional: name, strand, score, type, attributes

REGION     A genomic interval: chromosome:start-end
           Examples: chr17:7668421-7687490, chrX:1-1000000

ATTRIBUTE  Key-value metadata on features
           Examples: gene_name=TP53, clinical_significance=pathogenic
```

### Type System

```
<region>     := <chr>:<start>-<end>
<chr>        := string (chr1, chrX, NC_000001.11, etc.)
<start>      := integer (0-based, inclusive)
<end>        := integer (0-based, exclusive)
<track>      := string (track name or identifier)
<feature>    := string (feature name or ID)
<number>     := integer | float
<string>     := quoted or unquoted text
<boolean>    := true | false
<comparison> := = | != | > | < | >= | <= | contains | matches
```

---

## Commands

### Navigation Commands

Move the viewport to a location.

#### `NAVIGATE`
```gql
NAVIGATE <region>
NAVIGATE TO <feature> [IN <track>]
```

Examples:
```gql
NAVIGATE chr17:7668421-7687490
NAVIGATE TO TP53
NAVIGATE TO BRCA1 IN refseq_genes
```

#### `ZOOM`
```gql
ZOOM <factor>
ZOOM IN [<factor>]
ZOOM OUT [<factor>]
ZOOM TO <bp_width>
```

Examples:
```gql
ZOOM 2x              -- zoom out 2x (show 2x more bases)
ZOOM 0.5x            -- zoom in 2x (show half as many bases)
ZOOM IN              -- zoom in with default factor
ZOOM OUT 4x          -- zoom out 4x
ZOOM TO 1000         -- zoom to show exactly 1000bp
```

#### `PAN`
```gql
PAN <direction> [<amount>]
```

Examples:
```gql
PAN LEFT 10kb
PAN RIGHT 50%        -- pan by 50% of current view width
PAN LEFT             -- default amount
```

---

### Query Commands

Retrieve and filter features. Returns result sets.

#### `SELECT`
```gql
SELECT <what> [FROM <track>] [WHERE <conditions>] [IN <region>]
```

**`<what>` options:**
- `*` - all fields
- `FEATURES` - all features
- `GENES` - features where type is gene-like
- `VARIANTS` - features where type is variant-like
- `<field_list>` - specific fields

Examples:
```gql
SELECT GENES
SELECT GENES FROM refseq
SELECT VARIANTS WHERE clinical_significance = 'pathogenic'
SELECT GENES WHERE has_variants = true
SELECT * FROM my_peaks WHERE score > 100 IN chr17:7000000-8000000
```

#### `COUNT`
```gql
COUNT <what> [FROM <track>] [WHERE <conditions>] [IN <region>]
```

Examples:
```gql
COUNT VARIANTS IN TP53
COUNT GENES WHERE has_variants = true
COUNT FEATURES FROM my_track
```

#### `FIND`
```gql
FIND <feature_name> [IN <track>]
```

Returns the location of a named feature.

Examples:
```gql
FIND TP53
FIND rs12345 IN dbsnp
FIND ENSG00000141510
```

---

### Overlap/Intersection Commands

Find relationships between features across tracks.

#### `INTERSECT`
```gql
<query> INTERSECT <track>
<track> INTERSECT <track> [WHERE <conditions>]
```

Examples:
```gql
SELECT GENES INTERSECT variants_track
-- Returns genes that have overlapping variants

refseq_genes INTERSECT clinvar WHERE clinical_significance = 'pathogenic'
-- Returns genes overlapping pathogenic ClinVar variants
```

#### `WITHIN`
```gql
SELECT <what> WITHIN <feature>
SELECT <what> WITHIN <region>
```

Examples:
```gql
SELECT VARIANTS WITHIN TP53
SELECT VARIANTS WITHIN chr17:7668421-7687490
SELECT PEAKS WITHIN 10kb OF TSS
```

---

### Aggregation Commands

Summarize data over regions.

#### `SUMMARIZE`
```gql
SUMMARIZE <track> [BY <window>] [IN <region>]
```

Examples:
```gql
SUMMARIZE coverage BY 1kb IN chr17:7000000-8000000
SUMMARIZE variants BY gene
```

---

### Display Commands

Control visualization (these affect the UI, not data).

#### `SHOW` / `HIDE`
```gql
SHOW TRACK <track>
HIDE TRACK <track>
SHOW LABELS
HIDE GRID
```

#### `HIGHLIGHT`
```gql
HIGHLIGHT <region> [AS <name>] [COLOR <color>]
```

Examples:
```gql
HIGHLIGHT chr17:7670000-7675000 AS "Exon 5" COLOR red
```

#### `SET`
```gql
SET <option> = <value>
```

Examples:
```gql
SET track.height = 100
SET color_by = strand
```

---

### Composition

Queries can be composed using pipes.

```gql
<query> | <query>
```

Examples:
```gql
SELECT GENES | INTERSECT variants | WHERE variant_count > 5

FIND TP53 | SELECT VARIANTS WITHIN | WHERE impact = 'HIGH'
```

---

## Domain-Specific Queries

### Alignment/Read Depth

For BAM/CRAM tracks with read alignments.

```gql
-- Get depth at a position or region
SELECT DEPTH FROM alignments IN chr17:7675000-7675100
SELECT DEPTH FROM alignments AT chr17:7675088

-- Filter by depth
SELECT REGIONS WHERE DEPTH > 30 FROM alignments IN VIEW
SELECT REGIONS WHERE DEPTH < 10 FROM alignments IN TP53  -- low coverage regions

-- Read-level queries
SELECT READS FROM alignments WHERE mapping_quality > 30 IN VIEW
COUNT READS WHERE is_duplicate = false IN VIEW
SELECT READS WHERE has_variant AT chr17:7675088
```

### Signal Tracks

For bedGraph, BigWig, and other continuous signal data.

```gql
-- Get signal value at position
SELECT SIGNAL FROM h3k27ac AT chr17:7675000
SELECT SIGNAL FROM coverage IN chr17:7670000-7680000

-- Aggregate signal over regions
SELECT AVG(SIGNAL) FROM h3k27ac IN PROMOTER(TP53, 2kb, 500)
SELECT MAX(SIGNAL) FROM chip_seq BY gene

-- Find peaks/regions above threshold
SELECT REGIONS WHERE SIGNAL > 10 FROM h3k27ac IN VIEW
SELECT PEAKS FROM h3k27ac WHERE score > 100

-- Compare signals
SELECT GENES WHERE SIGNAL(h3k27ac) > SIGNAL(h3k4me3) IN PROMOTER
```

### Sequence and Base Composition

For FASTA/reference sequence tracks.

```gql
-- Get sequence
SELECT SEQUENCE IN chr17:7675000-7675100
SELECT SEQUENCE OF TP53

-- Base composition
SELECT GC_CONTENT IN chr17:7600000-7700000
SELECT GC_CONTENT BY window(1kb) IN VIEW

-- Find motifs
SELECT REGIONS WHERE SEQUENCE MATCHES 'TATAAA' IN PROMOTER(TP53, 500, 0)
SELECT REGIONS WHERE SEQUENCE MATCHES '[CG]G' IN VIEW  -- CpG sites

-- Composition queries
COUNT BASES WHERE base = 'G' IN VIEW
SELECT BASE_FREQUENCY IN chr17:7675000-7675100
```

### Variant Details

For VCF tracks - alleles, genotypes, annotations.

```gql
-- Query by allele
SELECT VARIANTS WHERE ref = 'A' AND alt CONTAINS 'T'
SELECT VARIANTS WHERE is_snp = true
SELECT VARIANTS WHERE is_indel = true
SELECT VARIANTS WHERE alt_count > 1  -- multi-allelic

-- Genotype queries (when samples present)
SELECT VARIANTS WHERE genotype(SAMPLE1) = 'het'
SELECT VARIANTS WHERE allele_frequency > 0.01
SELECT VARIANTS WHERE allele_depth(alt) > 10

-- IUPAC/ambiguous bases
SELECT VARIANTS WHERE alt MATCHES '[RYSWKM]'  -- ambiguity codes

-- Zygosity
SELECT VARIANTS WHERE is_homozygous = true
SELECT VARIANTS WHERE is_heterozygous = true IN SAMPLE1

-- Predicted impact (from annotations)
SELECT VARIANTS WHERE impact = 'HIGH'
SELECT VARIANTS WHERE consequence CONTAINS 'missense'
```

### Annotation Attributes

For GFF/GTF tracks - accessing the attributes column.

```gql
-- Query by any attribute
SELECT FEATURES WHERE attribute(gene_biotype) = 'protein_coding'
SELECT GENES WHERE attribute(description) CONTAINS 'tumor'

-- Common GFF attributes
SELECT FEATURES WHERE gene_id = 'ENSG00000141510'
SELECT FEATURES WHERE transcript_id MATCHES 'ENST00000.*'
SELECT EXONS WHERE exon_number = 1

-- Parent/child relationships
SELECT CHILDREN OF gene:TP53
SELECT PARENT OF transcript:ENST00000269305
SELECT EXONS WHERE parent = 'ENST00000269305'

-- Feature types from column 3
SELECT FEATURES WHERE feature_type = 'CDS'
SELECT FEATURES WHERE feature_type IN ('exon', 'CDS', 'UTR')
```

---

## Special Functions

### Region Functions
```gql
PROMOTER(<gene>, <upstream>, <downstream>)  -- e.g., PROMOTER(TP53, 2kb, 500)
UPSTREAM(<feature>, <distance>)
DOWNSTREAM(<feature>, <distance>)
FLANKING(<feature>, <distance>)
```

### Aggregate Functions
```gql
COUNT(<features>)
MIN(<field>)
MAX(<field>)
AVG(<field>)
SUM(<field>)
MEDIAN(<field>)
STDDEV(<field>)
```

### Boolean Functions
```gql
HAS_OVERLAP(<track>)      -- true if feature overlaps any feature in track
CONTAINS(<substring>)      -- for text matching
MATCHES(<regex>)           -- regex matching
IN(<list>)                 -- membership test
BETWEEN(<low>, <high>)     -- range test
```

### Sequence Functions
```gql
GC_CONTENT(<region>)                -- GC percentage (0-1)
BASE_FREQUENCY(<region>)            -- returns {A: n, C: n, G: n, T: n}
REVERSE_COMPLEMENT(<sequence>)      -- reverse complement
TRANSLATE(<sequence>)               -- DNA to protein (if CDS)
LENGTH(<feature>)                   -- feature length in bp
```

### Alignment Functions
```gql
DEPTH(<track>, <position>)          -- read depth at position
COVERAGE(<track>, <region>)         -- fraction of region covered
MAPPING_QUALITY(<read>)             -- MAPQ score
BASE_QUALITY(<read>, <position>)    -- per-base quality
```

### Signal Functions
```gql
SIGNAL(<track>, <position>)         -- signal value at position
SIGNAL(<track>, <region>)           -- signal values over region
PEAK_CALL(<track>, <threshold>)     -- call peaks above threshold
```

### Variant Functions
```gql
ALLELE_FREQUENCY(<variant>)         -- AF from INFO or computed
GENOTYPE(<variant>, <sample>)       -- genotype call for sample
IS_TRANSITION(<variant>)            -- A<>G or C<>T
IS_TRANSVERSION(<variant>)          -- other substitutions
CONSEQUENCE(<variant>)              -- predicted effect (if annotated)
```

---

## Scope Keywords

Queries can be scoped to specific regions:

| Keyword | Meaning |
|---------|---------|
| `IN VIEW` | Current viewport region |
| `IN CHROMOSOME` | Current chromosome (all of it) |
| `IN chr17` | Specific chromosome (all of it) |
| `IN chr17:1000-2000` | Specific region with coordinates |
| *(no IN clause)* | All loaded data (global) |

Examples:
```gql
SELECT GENES IN VIEW                    -- current viewport only
SELECT GENES IN CHROMOSOME              -- current chromosome
SELECT GENES IN chr17                   -- all of chr17
SELECT GENES IN chr17:7668421-7687490   -- specific region
SELECT GENES                            -- all loaded data
```

### Implicit Context

Some queries use implicit context from the browser state:

| Implicit | Meaning |
|----------|---------|
| `LOADED TRACKS` | All currently loaded tracks |
| `VISIBLE TRACKS` | Tracks that are toggled visible |

---

## Scope Clarification (AI Behavior)

**IMPORTANT:** When translating natural language to GQL, the AI must ask for clarification if scope is not explicitly specified.

Users have different expectations - some mean "all loaded data", others mean "current view". The AI cannot know which without asking.

### Ambiguous (requires clarification):
- "show me genes with variants" → CLARIFY: scope unclear
- "count the variants" → CLARIFY: scope unclear
- "find pathogenic mutations" → CLARIFY: scope unclear

### Explicit (no clarification needed):
- "show me genes with variants **in view**" → use `IN VIEW`
- "show me **all** genes with variants" → no IN clause (global)
- "count variants **on chr17**" → use `IN chr17`
- "variants **in BRCA1**" → use `WITHIN BRCA1`

### Keywords that indicate explicit scope:
- "here", "in view", "visible", "on screen" → `IN VIEW`
- "on this chromosome" → `IN CHROMOSOME`
- "all", "total", "everywhere", "globally" → no IN clause
- "in/on chr17", "chromosome 17" → `IN chr17`

---

## Response Format

All queries return a structured response:

```typescript
interface GQLResponse {
  success: boolean;
  query: string;           // The executed GQL
  command: string;         // Primary command (SELECT, NAVIGATE, etc.)

  // For data queries
  results?: Feature[];
  count?: number;

  // For navigation
  region?: Region;

  // For errors
  error?: string;
  suggestion?: string;     // "Did you mean...?"

  // Metadata
  executionTime: number;
  dataSource: 'local' | 'indexed' | 'remote';
}
```

---

## Examples: Natural Language to GQL

| Natural Language | GQL |
|-----------------|-----|
| "Show me genes with variants" | `CLARIFY: Do you want genes in view, on this chromosome, or all data?` |
| "Show me all genes with variants" | `SELECT GENES INTERSECT variants` |
| "Show me genes with variants in view" | `SELECT GENES INTERSECT variants IN VIEW` |
| "Go to TP53" | `NAVIGATE TO TP53` |
| "What variants are in BRCA1?" | `SELECT VARIANTS WITHIN BRCA1` |
| "How many pathogenic variants total?" | `COUNT VARIANTS WHERE clinical_significance = 'pathogenic'` |
| "How many variants are there?" | `CLARIFY: Do you want to count in view, on this chromosome, or all data?` |
| "Count variants on chr17" | `COUNT VARIANTS IN chr17` |
| "Zoom in on the promoter" | `NAVIGATE PROMOTER(current_gene, 2kb, 500)` |
| "Hide the coverage track" | `HIDE TRACK coverage` |
| "Which genes have more than 5 variants?" | `SELECT GENES INTERSECT variants \| WHERE variant_count > 5` |
| "Show pathogenic variants near TP53" | `SELECT VARIANTS WHERE clinical_significance = 'pathogenic' WITHIN FLANKING(TP53, 10kb)` |

---

## Implementation Phases

### Phase 1: Core Navigation & Basic Queries ✅ IMPLEMENTED
- ✅ `NAVIGATE`, `ZOOM`, `PAN`
- ✅ `SELECT GENES`, `SELECT VARIANTS`, `SELECT FEATURES`
- ✅ `FIND <feature>` (via NAVIGATE TO)
- ✅ Basic `WHERE` clauses (=, !=, >, <, CONTAINS)
- ✅ `INTERSECT` for overlap queries
- ✅ `WITHIN` for containment queries
- ✅ `COUNT` queries
- ✅ AI-powered natural language → GQL translation (Claude/OpenAI)
- ✅ Scope keywords: `IN VIEW`, `IN CHROMOSOME`, `IN chr17`, `IN chr17:start-end`
- ✅ Scope clarification for ambiguous queries

### Phase 2: Annotation & Filtering
- `COUNT`, `SUMMARIZE`
- Region functions (`PROMOTER`, `FLANKING`, `UPSTREAM`, `DOWNSTREAM`)
- Attribute access for GFF (`attribute(key)`, `gene_id`, etc.)
- Parent/child traversal (`SELECT CHILDREN OF`, `SELECT PARENT OF`)
- Advanced `WHERE` (AND, OR, IN, BETWEEN, MATCHES)
- Pipe composition

### Phase 3: Signal & Depth
- `SELECT SIGNAL` from bedGraph/BigWig
- `SELECT DEPTH` from BAM/CRAM
- Aggregates over regions (`AVG(SIGNAL)`, `MAX(DEPTH)`)
- Window-based queries (`BY window(1kb)`)
- `SELECT READS` with quality filters

### Phase 4: Sequence & Variants
- `SELECT SEQUENCE` from FASTA
- `GC_CONTENT`, `BASE_FREQUENCY`
- Motif search (`SEQUENCE MATCHES`)
- Variant allele queries (ref, alt, multi-allelic)
- Genotype queries (per-sample, zygosity)
- `IS_TRANSITION`, `IS_TRANSVERSION`

### Phase 5: Remote & Scale
- Query planning for indexed files (tabix, BAI)
- Pagination for large results
- Streaming responses
- Federated queries (multiple remote sources)
- Query caching and optimization

---

## Notes for AI Implementation

When generating GQL from natural language:

1. **Prefer explicit over implicit** - Use track names when known
2. **Validate against schema** - Check that referenced tracks exist
3. **Handle ambiguity** - Ask for clarification or return multiple interpretations
4. **Preserve intent** - "cancer genes" might mean genes with cancer-related variants, not a literal field

The AI should have access to:
- List of loaded tracks and their types
- Current viewport location
- Available feature types in each track
- This specification

---

## Open Questions

1. **Case sensitivity** - Should GQL be case-insensitive? (Propose: yes, except for attribute values)
2. **Quoting** - When are quotes required? (Propose: only for values with spaces)
3. **Units** - Standardize on `bp`, `kb`, `mb`, `gb`? (Propose: yes, default to bp)
4. **Error handling** - How strict? (Propose: lenient parsing, warn on ambiguity)
5. **Extensibility** - How to add custom commands? (Propose: plugin system)

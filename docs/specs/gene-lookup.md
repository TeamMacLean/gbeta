# Gene Lookup Feature Specification

**Status:** Approved
**Date:** 2026-01-23
**Session:** 25

## Overview

Add gene name lookup to gBeta, allowing users to navigate and query by gene symbol instead of coordinates. Gene names become aliases for coordinates within GQL.

## Core Concept

A search term is resolved to coordinates via external APIs. Any GQL command that accepts coordinates can accept a gene name.

```
NAVIGATE BRCA1              # looks up BRCA1 → chr17:43044292-43170245
ZOOM TP53                   # looks up TP53 → chr17:7668421-7687490
SELECT * WITHIN MYC         # selects features overlapping MYC region
```

## Pattern Detection

```
/^chr\w+:\d+-\d+$/  →  coordinates (use directly)
anything else       →  search term (lookup via API)
```

Examples:
- `chr17:43044292-43170245` → coordinates
- `BRCA1` → lookup
- `breast cancer` → lookup
- `TP53` → lookup

## API Backends

### Dual-Backend Architecture

```
┌─────────────────────────────────────────┐
│           Gene Lookup Service           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐    ┌─────────────┐    │
│  │ MyGene.info │    │  Ensembl    │    │
│  │             │    │  REST API   │    │
│  │ 17 assemblies│   │ 6 assemblies│    │
│  └─────────────┘    └─────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### MyGene.info Coverage (17 assemblies)

| Assembly | Species | Taxid | Genes |
|----------|---------|-------|-------|
| grch38, grch37, t2t-chm13 | Human | 9606 | ~62,000 |
| mm39, mm10 | Mouse | 10090 | 155,195 |
| rn7 | Rat | 10116 | 48,954 |
| danrer11 | Zebrafish | 7955 | 61,543 |
| dm6 | Drosophila | 7227 | 31,107 |
| ce11 | C. elegans | 6239 | 46,943 |
| galGal6 | Chicken | 9031 | 32,498 |
| tair10 | Arabidopsis | 3702 | 38,337 |
| irgsp1 | Rice | 39947 | 42,793 |
| zm-b73-nam5 | Maize | 4577 | 49,971 |
| iwgsc-refseq2 | Wheat | 4565 | 168,039 |
| morex-v3 | Barley | 4513 | 19,492 |
| spombe | S. pombe | 4896 | 12,646 |
| ecoli-k12 | E. coli | 511145 | 4,652 |
| sars-cov-2 | SARS-CoV-2 | 2697049 | 12 |

### Ensembl REST API Coverage (6 assemblies)

| Assembly | Species | Ensembl Division |
|----------|---------|------------------|
| saccer3 | S. cerevisiae | EnsemblFungi |
| botrytis | Botrytis cinerea | EnsemblFungi |
| magnaporthe | Pyricularia oryzae | EnsemblFungi |
| puccinia | Puccinia graminis | EnsemblFungi |
| zymoseptoria | Zymoseptoria tritici | EnsemblFungi |
| phytophthora | Phytophthora infestans | EnsemblProtists |

## Service Interface

```typescript
interface GeneResult {
  symbol: string;      // BRCA1
  name: string;        // BRCA1 DNA repair associated
  chromosome: string;  // chr17
  start: number;       // 43044292
  end: number;         // 43170245
  strand: '+' | '-';
  source: 'mygene' | 'ensembl';
}

// Returns top N matches, empty array if none, throws on API error
async function lookupGene(
  term: string,
  assembly: GenomeAssembly
): Promise<GeneResult[]>
```

## Behavior

### Multiple Matches
When a lookup returns multiple results, show a picker UI:

```
┌─────────────────────────┐
│  Gene Picker            │
│                         │
│  ○ BRCA1                │
│    DNA repair associated│
│    chr17:43,044,292     │
│                         │
│  ○ BRCA2                │
│    DNA repair associated│
│    chr13:32,315,086     │
│                         │
│  [↑/↓ to navigate]      │
└─────────────────────────┘
```

User selects one, then the command executes with those coordinates.

### No Matches
Clear error message:
```
No genes matching 'BRAC1' found for hg38
```

### API Error
Clear error message:
```
Gene lookup failed: Network error
```

### Assembly Awareness
- Lookup uses current assembly's taxid (MyGene) or species name (Ensembl)
- Coordinates are assembly-specific
- Changing assembly invalidates cached lookups

## Caching

- Cache key: `{term}:{assembly.id}`
- Cache value: `GeneResult[]`
- Lifetime: Session only (cleared on page refresh)
- No persistent storage

## GQL Integration

All coordinate-accepting commands support gene names:

```gql
# Navigation
NAVIGATE BRCA1
NAVIGATE gene:BRCA1        # explicit (optional)

# Zoom
ZOOM TP53
ZOOM OUT MYC

# Selection
SELECT * WITHIN BRCA1
SELECT * WITHIN BRCA1 INTERSECT my_peaks

# Highlighting
HIGHLIGHT BRCA1
CLEAR HIGHLIGHT

# Pan (if applicable)
PAN LEFT BRCA1
```

## UI Integration

### Entry Points
1. **SearchBar** - existing search bar handles gene names
2. **GQL Console** - direct GQL commands
3. **Natural Language** - AI translates "show me BRCA1" → `NAVIGATE BRCA1`

### Gene Picker Component
- Appears when multiple matches found
- Keyboard navigable (↑/↓, Enter to select, Esc to cancel)
- Shows: symbol, full name, coordinates
- Dismissable

## API Details

### MyGene.info

**Endpoint:** `https://mygene.info/v3/query`

**Request:**
```
GET /v3/query?q=BRCA1&species=9606&fields=symbol,name,genomic_pos&size=10
```

**Response:**
```json
{
  "hits": [
    {
      "symbol": "BRCA1",
      "name": "BRCA1 DNA repair associated",
      "genomic_pos": {
        "chr": "17",
        "start": 43044292,
        "end": 43170245,
        "strand": -1
      }
    }
  ]
}
```

### Ensembl REST API

**Endpoint:** `https://rest.ensembl.org`

**Step 1 - Symbol lookup:**
```
GET /xrefs/symbol/{species}/{symbol}?content-type=application/json
```

**Step 2 - Get coordinates:**
```
GET /lookup/id/{gene_id}?content-type=application/json;expand=1
```

**Response:**
```json
{
  "display_name": "Bcboa6",
  "id": "Bcin01g00060",
  "seq_region_name": "1",
  "start": 15855,
  "end": 23759,
  "strand": 1,
  "assembly_name": "ASM83294v1"
}
```

## Configuration

Assembly-to-API mapping stored in lookup service:

```typescript
const GENE_LOOKUP_CONFIG: Record<string, LookupConfig> = {
  // MyGene.info
  'grch38': { backend: 'mygene', taxid: 9606 },
  'grch37': { backend: 'mygene', taxid: 9606 },
  't2t-chm13': { backend: 'mygene', taxid: 9606 },
  'mm39': { backend: 'mygene', taxid: 10090 },
  // ... etc

  // Ensembl
  'saccer3': { backend: 'ensembl', species: 'saccharomyces_cerevisiae' },
  'botrytis': { backend: 'ensembl', species: 'botrytis_cinerea' },
  // ... etc
};
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No matches | Return empty array, UI shows "No genes found" |
| API timeout | Throw error, UI shows "Lookup timed out" |
| API rate limit | Throw error, UI shows "Too many requests" |
| Network error | Throw error, UI shows "Network error" |
| Invalid assembly | Throw error, UI shows "Gene lookup not available for this assembly" |

## Future Considerations

Not in scope for initial implementation:

- **Autocomplete/typeahead** - search as user types
- **Gene info panel** - detailed gene information display
- **Batch lookup** - multiple genes at once
- **Ortholog lookup** - find same gene in different species
- **Link-out** - click gene to open in NCBI/Ensembl

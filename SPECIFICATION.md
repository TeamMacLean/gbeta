# gBeta - Genome Browser Specification

## Vision
A modern, lightweight genome browser that makes genomic data exploration fast, beautiful, and intelligent.

## Design Philosophy
1. **Fast by default** - Sub-second load, instant pan/zoom
2. **AI-native** - Natural language is a first-class input method
3. **Web-first** - No install, works anywhere, share sessions via URL
4. **Beautiful** - Modern aesthetics, not 2005 Java UI

---

## Tech Stack

### Core
- **Language**: TypeScript (strict mode)
- **Framework**: Svelte 5 + SvelteKit
- **Rendering**: HTML Canvas (tracks) + SVG (overlays/UI)
- **Build**: Vite
- **Styling**: Tailwind CSS

### Why Svelte?
- Smaller bundle than React/Vue
- Compiled output = faster runtime
- Reactive by default, minimal boilerplate
- Svelte 5 runes are elegant for genomic state

### AI Layer
- Pluggable LLM backend (Anthropic Claude, OpenAI, local models)
- Query translation service: natural language → genomic coordinates/filters
- Future: annotation summarization, pattern detection

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ Navigation  │ │ Track View  │ │ AI Search Bar   │   │
│  │ (chr:pos)   │ │ (Canvas)    │ │ (natural lang)  │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│                   Core Services                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ Viewport    │ │ Track       │ │ AI Query        │   │
│  │ Controller  │ │ Manager     │ │ Service         │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ File        │ │ Reference   │ │ Index           │   │
│  │ Parsers     │ │ Genome      │ │ Manager         │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Data Format Support

### v0.1.0 (MVP)
| Format | Purpose | Complexity |
|--------|---------|------------|
| BED    | Intervals/features | Low |
| GFF3   | Gene annotations | Medium |

### v0.2.0
| Format | Purpose | Complexity |
|--------|---------|------------|
| VCF    | Variants | Medium |
| BigWig | Coverage/signal | Medium |

### v0.3.0+
| Format | Purpose | Complexity |
|--------|---------|------------|
| BAM    | Alignments | High (needs indexing) |
| CRAM   | Compressed alignments | High |

---

## AI Integration Design

### Query Translation Pipeline
```
User Input: "show me the first exon of BRCA1"
     │
     ▼
┌─────────────────────────────────────┐
│ AI Query Service                    │
│ - Parse intent (navigate, filter,   │
│   annotate, compare)                │
│ - Resolve gene names → coordinates  │
│ - Generate viewport command         │
└─────────────────────────────────────┘
     │
     ▼
Output: { chr: "17", start: 43044295, end: 43045802, highlight: "exon1" }
```

### AI Features Roadmap
1. **v0.1.0**: Natural language → coordinate navigation
2. **v0.2.0**: "Explain this region" summaries
3. **v0.3.0**: Pattern detection ("find similar regions")

### Gene Name Resolution
- Bundle a lightweight gene index (name → coordinates)
- Start with human (GRCh38), expandable
- ~20k genes = small JSON/SQLite

### AI Prompting Strategy

The AI query service uses a structured prompt to translate natural language to navigation commands.

**System Prompt Core:**
```
You are a genomic navigation assistant for gBeta genome browser.
Your role is to translate natural language queries into precise genomic coordinates.

You have access to a gene index with names and coordinates for the current assembly (GRCh38/hg38).

For each query, respond with a JSON object:
{
  "intent": "navigate" | "search" | "filter" | "explain" | "unknown",
  "chromosome": "chr1" | null,
  "start": number | null,
  "end": number | null,
  "gene": "gene_name" | null,
  "feature": "exon" | "intron" | "promoter" | "utr" | null,
  "message": "Human-readable response",
  "confidence": 0.0-1.0
}

Examples:
- "go to BRCA1" → navigate to BRCA1 gene coordinates
- "show chr17:43000000-43500000" → navigate to exact coordinates
- "zoom into exon 3 of TP53" → navigate to specific exon
- "what's at this position?" → explain (requires context mode)

If unsure, set confidence low and ask for clarification in message.
```

**Prompt Engineering Principles:**
1. **Structured output**: JSON ensures parseable responses
2. **Confidence scores**: Low confidence triggers fallback to gene index lookup
3. **Intent classification**: Different intents trigger different browser actions
4. **Graceful degradation**: Unknown queries get helpful error messages

**Fallback Chain:**
1. Try AI interpretation
2. If confidence < 0.7, check local gene index
3. If no gene match, try coordinate regex (chr1:100-200)
4. If all fail, show "Did you mean...?" suggestions

---

## v0.1.0 Roadmap

### Milestone 1: Foundation
- [ ] Project scaffolding (SvelteKit + TypeScript + Tailwind)
- [ ] Basic application shell with header/main layout
- [ ] Viewport state management (chr, start, end, zoom)

### Milestone 2: Track Rendering
- [ ] Canvas-based track renderer
- [ ] BED file parser
- [ ] GFF3 file parser
- [ ] Feature rendering (rectangles, arrows for strand)
- [ ] Track labels and styling

### Milestone 3: Navigation
- [ ] Coordinate input (chr1:1000-2000)
- [ ] Click-drag panning
- [ ] Scroll/pinch zooming
- [ ] Minimap overview (stretch)

### Milestone 4: File Handling
- [ ] Local file upload (drag & drop)
- [ ] URL loading for remote files
- [ ] Multi-track support

### Milestone 5: AI Search
- [ ] Search bar component
- [ ] LLM integration (configurable API)
- [ ] Gene name index (human GRCh38)
- [ ] Natural language → navigation

### Milestone 6: Polish
- [ ] Responsive design
- [ ] Keyboard shortcuts
- [ ] URL state (shareable links)
- [ ] Error handling & loading states

---

## UI/UX Guidelines

### Color Palette
- Dark mode first (easier on eyes for long sessions)
- High contrast for genomic features
- Consistent strand coloring (+ strand / - strand)

### Interactions
- Hover tooltips for features
- Click to select/highlight
- Right-click context menu (future)

### Performance Targets
- Initial load: < 2 seconds
- Pan/zoom: 60fps
- File parsing: Progressive/streaming where possible

---

## Security Model

### Data Locality Principle
**Genomic data never leaves the browser unless explicitly authorized.**

### File Handling
- All parsing happens client-side (JavaScript/WASM)
- Files loaded via FileReader API or fetch (for URLs)
- No server-side storage or processing
- Files can be loaded from local disk or user-specified URLs

### AI Privacy Modes

| Mode | Description | Data Sent to AI |
|------|-------------|-----------------|
| **Query Only** (default) | Only search text sent | "go to BRCA1" |
| **With Context** (opt-in) | Include visible region metadata | Query + "viewing chr17:43M-44M" |
| **Local LLM** | Full privacy | Nothing leaves machine |

### AI Query Sanitization
- Strip any pasted sequences before sending
- Never send actual genomic data (variants, reads)
- User controls what context is shared
- Clear UI indicators when data will be sent externally

### Local LLM Support
- Ollama integration for full offline use
- User provides endpoint URL
- No API keys needed
- Complete data sovereignty

### UI Privacy Indicators
- Badge showing current AI mode
- Warning before first external AI query
- Settings to disable AI entirely

---

## Non-Goals for v0.1.0
- User accounts / authentication
- Server-side storage
- Collaborative editing
- BAM/CRAM support (complex, defer)
- Multiple genome assemblies in one session

---

## Resolved Questions
1. **Dark mode**: Dark-only for v0.1.0 (simpler)
2. **AI provider**: Configurable (Claude, OpenAI, Ollama/local)
3. **Security**: Yes - data locality is priority, see Security Model above

---

## Success Criteria for v0.1.0
- [ ] Can load a BED and GFF3 file
- [ ] Can navigate to any genomic coordinate
- [ ] Can pan and zoom smoothly
- [ ] Can ask "go to TP53" and it navigates there
- [ ] Looks modern and professional
- [ ] Bundle size < 500KB (excluding gene index)
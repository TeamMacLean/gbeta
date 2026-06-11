# Tutorial 5: Reproducible Analysis

> **Audience**: Power users who need to save, share, and reproduce their work
> **Time**: 25-35 minutes
> **Prerequisites**: Comfortable with GQL queries ([Tutorial 3](03-advanced-queries.md))
> **Last updated**: Session 23 (2026-01-22)

## What You'll Learn

- Understanding URL state persistence
- Sharing views with collaborators
- Using the GQL Console for scientific workflows
- Saving and organizing queries
- Creating reproducible analysis scripts
- Best practices for publication-ready work

## Why Reproducibility Matters

In genomics research, you need to:
- Return to exact views later
- Share findings with collaborators
- Document what you found and how
- Reproduce analyses for publications

GQL ensures every action is recorded as a reproducible command.

> [!TIP]
> Save GQL commands, not natural language - GQL is guaranteed to reproduce the same result.

---

## Step 1: URL State

gBeta stores your viewport state in the URL.

### What's in the URL

```
https://teammaclean.github.io/gbetter/?chr=chr17&start=7668421&end=7687490
```

This encodes:
- Current chromosome (`chr=chr17`)
- Start position (`start=7668421`)
- End position (`end=7687490`)

### Copying your current view

1. Navigate to a region of interest
2. Copy the URL from your browser's address bar
3. Share that URL

### Opening a shared URL

When someone opens your URL, they see exactly the same genomic region.

> [!IMPORTANT]
> URL state captures viewport only, not loaded tracks. Share data files separately.

---

## Step 1.5: Settings Persistence

gBeta also persists your display preferences.

### What's saved automatically

- **Theme** (Light/Dark/High-Contrast)
- **Color palette** (Set2/Dark2/Paired)
- **Gene model style**

### Where it's stored

Settings are saved in your browser's localStorage:
- Persists across sessions
- Specific to this browser
- Not shared via URL (yet)

> [!NOTE]
> Settings persist across sessions in the same browser but don't sync across devices.

### For collaboration

When sharing analysis with colleagues, note your settings:

```markdown
## Display Settings
- Theme: Light
- Palette: Set2
- Assembly: GRCh38
```

This ensures they see the same visualization style.

> [!IMPORTANT]
> Display settings (theme, palette) are stored in browser localStorage, not in URLs.

---

## Step 2: Sharing Views

### Basic sharing

After navigating to a region:

1. Copy the URL
2. Send to collaborator via email, Slack, etc.
3. They paste it in their browser

### With loaded tracks

URL state currently captures **viewport only**. For full reproducibility:

1. Share the URL
2. Also share your data files
3. Include instructions: "Load sample.vcf, then open this URL"

### Future: Full session sharing

*Coming soon: URLs that encode loaded tracks and filters*

---

## Step 3: GQL for Reproducibility

Every action in gBeta can be expressed as GQL.

### Natural language to GQL

When you type natural language, gBeta shows the GQL translation:

```
You typed: "show me genes with variants"
GQL: list genes with variants
```

### Save the GQL, not the English

For reproducibility, save the GQL command:

```
# Reproducible - always works
list genes with variants

# Not reproducible - might translate differently
"what genes have variants in them?"
```

---

## Step 4: Creating Analysis Scripts

Build a sequence of GQL commands for your analysis.

### Example: Variant Analysis Script

```gql
# Variant Analysis Workflow
# Date: 2024-01-15
# Data: sample.gff3, sample.vcf

# Navigate to region of interest
navigate chr17:7668421-7687490

# Get overview of variants
COUNT VARIANTS IN VIEW

# Find genes with variants
list genes with variants

# Check specific gene
list variants in TP53

# Filter to pathogenic
SELECT VARIANTS WHERE significance = 'pathogenic'

# Top affected genes
SELECT GENES INTERSECT variants ORDER BY length DESC LIMIT 10
```

### Save as a text file

Save your script as `my-analysis.gql` for future reference.

> [!TIP]
> Use version control (git) for your `.gql` script files.

### Re-run analysis

Paste commands into gBeta's search bar one at a time to reproduce your workflow.

---

## Step 5: The GQL Console

The GQL Console is the primary interface for reproducible analysis. Unlike the Search Bar (which is for quick navigation), the Console is designed for scientific workflows.

### Opening the console

- Click the **GQL Console** button in the header
- Or press `Cmd+`` (backtick) on Mac / `Ctrl+`` on Windows/Linux
- The keyboard shortcut is shown on the button

### Console features

The GQL Console provides:

| Feature | Description |
|---------|-------------|
| **Natural Language input** | Type questions in plain English (requires AI) |
| **GQL input** | View/edit the query before running |
| **Results panel** | Clickable list with navigation |
| **History tab** | All queries from this session |
| **Saved tab** | Your saved query collection |
| **Expand button** | Larger workspace for complex queries |

### Why use the Console instead of the Search Bar?

| Feature | Search Bar | GQL Console |
|---------|------------|-------------|
| Quick navigation | Yes | Yes |
| AI translation | No | Yes (with [AI configured](../AI-SETUP.md)) |
| Edit query before running | No | Yes |
| See full results list | No | Yes |
| Save queries | No | Yes |
| Export/import queries | No | Yes |
| Share via URL | No | Yes |

### Running queries

1. Type natural language in the top input, press Enter to translate
2. Review the GQL in the bottom input (edit if needed)
3. Press `Cmd+Enter` or click **Execute**
4. Click any result to navigate there

---

## Step 6: Saved Queries

*Feature availability may vary*

### Saving a query

1. Write your query in the console
2. Click "Save Query"
3. Give it a name and description
4. Query is stored locally

### Loading saved queries

1. Click "Saved Queries" in the console
2. Browse your saved queries
3. Click to load

### Organizing queries

Group related queries:
- `variant-analysis/` - Variant-related queries
- `qc/` - Quality control checks
- `figures/` - Views for publication figures

---

## Step 7: Exporting Results

### Results as text

After running a query:
1. Results appear in the panel
2. Select and copy
3. Paste into your document

### Results as table

*Feature availability may vary*

Click "Export" to download results as:
- TSV (tab-separated)
- CSV (comma-separated)
- JSON

### Coordinates for other tools

Copy coordinates to use in other tools:

```
# From gBeta
chr17:7668421-7687490

# Use in samtools
samtools view aligned.bam chr17:7668421-7687490

# Use in bedtools
echo -e "chr17\t7668421\t7687490" > region.bed
```

---

## Step 8: Documentation Best Practices

### Document your analysis

Create a README for your analysis:

```markdown
# TP53 Variant Analysis

## Data files
- genes.gff3 - Gene annotations (GRCh38)
- patient.vcf - Patient variants

## GQL Commands

1. Navigate to TP53
   ```
   navigate chr17:7668421-7687490
   ```

2. Find variants
   ```
   list variants in TP53
   ```

3. Filter pathogenic
   ```
   SELECT VARIANTS WHERE significance = 'pathogenic'
   ```

## Results
Found 3 pathogenic variants in TP53:
- chr17:7674220 G>A (p.R248Q)
- chr17:7673802 G>A (p.R273H)
- chr17:7675088 C>T (p.R175H)
```

### Include session information

Record:
- gBeta version
- Date of analysis
- Data file versions/sources
- Genome assembly used
- Display settings (theme, palette)

---

## Step 9: Collaboration Workflow

### For the analyst

1. Do your analysis
2. Save GQL commands to a script file
3. Document key findings
4. Share: URL + script + data files

### For the recipient

1. Open the shared URL
2. Load the same data files
3. Run the GQL script
4. Verify they see the same results

### Version control

Consider storing your `.gql` scripts in git:

```bash
git add analysis/variant-check.gql
git commit -m "Add TP53 variant analysis"
```

---

## Try It Yourself

Create a reproducible analysis workflow:

### 1. Set up your session

1. Open gBeta: https://teammaclean.github.io/gbetter/
2. Set theme to **Light** (Settings > Display) for publication-ready screenshots
3. Select assembly **GRCh38**

### 2. Navigate and explore

```
# Go to TP53
navigate chr17:7668421-7687490

# Zoom to see gene structure
zoom in
zoom in

# Filter to exons
filter type=exon
```

### 3. Capture your state

1. Copy the URL from your browser - it now contains your exact position
2. Write down the GQL commands you used
3. Note your display settings

### 4. Test reproducibility

1. Open a new browser tab
2. Paste the URL
3. Verify you're at the same position
4. Re-run your GQL commands
5. Confirm you see the same view

### 5. Document for sharing

Create a simple script file `tp53-analysis.gql`:

```
# TP53 Analysis
# Author: [Your name]
# Date: [Today's date]
# Assembly: GRCh38
# Theme: Light, Set2 palette

# Navigate to TP53
navigate chr17:7668421-7687490

# Focus on coding regions
filter type=exon

# Zoom for detail
zoom in
zoom in

# Highlight region of interest
highlight chr17:7674000-7676000
```

Share this file with your URL for full reproducibility.

---

## Complete Reproducibility Checklist

<details>
<summary>Full Reproducibility Checklist</summary>

For fully reproducible analysis:

- [ ] **Assembly**: Document which genome assembly (e.g., GRCh38)
- [ ] **Display settings**: Note theme and palette used
- [ ] **Data files**: Share or document sources of all loaded files
- [ ] **GQL script**: Save all commands used in order
- [ ] **URL state**: Capture key viewport positions
- [ ] **Results**: Export or screenshot query results
- [ ] **Documentation**: Write README explaining the workflow

</details>

---

## Example: Publication-Ready Workflow

Preparing a figure for publication:

```gql
# Figure 2: TP53 Variants
# For: Smith et al., Journal of Genomics, 2024

# Exact viewport for figure
navigate chr17:7673700-7674500

# Load and filter
# (load patient.vcf manually)

# Show only exons for clarity
filter type=exon

# Highlight variant region
highlight chr17:7674200-7674250

# Take screenshot (manual step)
# Export as Figure_2_TP53_variants.png
```

Share this script with your co-authors so they can reproduce the exact view.

---

## Troubleshooting

### "My colleague sees something different"

Check:
- Same data files?
- Same genome assembly?
- Same display settings (theme/palette)?
- URL copied correctly?
- Filters applied?

### "I can't find my saved query"

Saved queries are stored in browser local storage:
- Different browser = different storage
- Cleared browser data = lost queries
- Export important queries as `.gql` files

### "The URL is too long"

For complex state, URLs can get long:
- Use URL shorteners for sharing
- Or share as a script file instead

---

## Summary

Reproducibility in gBeta:

| What | How |
|------|-----|
| Viewport | URL parameters |
| Display settings | Browser localStorage |
| Commands | GQL scripts |
| Results | Export feature |
| Full session | URL + files + script + settings |

Remember: **Save the GQL, share the URL, document everything.**

---

## Next Steps

You've completed all tutorials! For reference:

- [GQL Manual](../GQL-MANUAL.md) - Complete command reference
- [GQL Examples](../GQL-EXAMPLES.md) - More query patterns
- [README](../../README.md) - Project overview

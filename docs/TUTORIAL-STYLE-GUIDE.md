# Tutorial Style Guide

**Last updated**: Session 23 (2026-01-22)

This guide defines the style and structure for all gBeta tutorials. Follow it when creating or updating tutorials.

---

## Core Principles

1. **Standalone** - Each tutorial is self-contained. Never assume the reader has completed other tutorials.
2. **Pedagogic** - Teach concepts, not just steps. Explain *why*, not just *how*.
3. **Practical** - Include real examples users can try immediately.
4. **Accurate** - UI descriptions must match the current application exactly.

---

## Document Structure

Every tutorial must follow this structure:

```markdown
# Tutorial Title

> **Audience**: [Who this is for - be specific]
> **Time**: [Estimated completion time]
> **Prerequisites**: [What they need before starting, or "None"]
> **Last updated**: Session [N] (YYYY-MM-DD)

## What You'll Learn

[2-4 bullet points of concrete outcomes]

## [Main Content Sections]

[Teaching content with steps, explanations, examples]

## Try It Yourself

[Hands-on exercise with real data/URLs]

## Summary

[Key takeaways - what they now know how to do]

## Next Steps

[Optional: suggest related tutorials or features to explore]
```

---

## Writing Style

### Tone
- Direct and friendly, not formal or condescending
- Second person: "Click the **Settings** button" not "The user should click..."
- Active voice: "gBeta loads the track" not "The track is loaded by gBeta"

### Length
- As detailed as needed to teach the concept properly
- Break long sections into digestible chunks with subheadings
- No arbitrary word limits, but respect the reader's time

### Technical Accuracy
- Use exact UI element names in **bold**: "Click **Add Tracks**"
- Use exact menu paths: "Go to **Settings > Display > Theme**"
- GQL commands in `code blocks`
- File formats in caps: BED, GFF3, BAM

---

## Code Examples

### GQL Commands
Always use fenced code blocks with expected context:

```markdown
Navigate to TP53:
```
navigate chr17:7668421-7687490
```

This moves the viewport to the TP53 gene region on chromosome 17.
```

### URLs
Include real, working URLs from R2 storage that users can copy-paste:

```markdown
Try loading this BigWig file:
```
https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/example.bw
```
```

---

## GitHub Markdown Features

Use these GitHub-flavored markdown features for better readability. They render automatically on GitHub with styled boxes and colors.

### Alerts (Callout Boxes)

Use alerts to highlight important information:

```markdown
> [!NOTE]
> Useful background information the user should know.

> [!TIP]
> Helpful advice for doing things more efficiently.

> [!IMPORTANT]
> Key information essential to success.

> [!WARNING]
> Common pitfalls or things that cause confusion.

> [!CAUTION]
> Actions that could cause problems if done incorrectly.
```

**When to use each:**

| Alert | Use for |
|-------|---------|
| `[!NOTE]` | Context, background, "good to know" info |
| `[!TIP]` | Pro tips, shortcuts, best practices |
| `[!IMPORTANT]` | Must-know info, key concepts |
| `[!WARNING]` | Common mistakes, confusing areas |
| `[!CAUTION]` | Destructive actions, data loss risks |

### Collapsible Sections

Use for optional detail, solutions to exercises, or lengthy reference info:

```markdown
<details>
<summary>Click to see the solution</summary>

The answer is:
```
SELECT GENES WHERE strand = '+' ORDER BY length DESC LIMIT 5
```

</details>
```

### Task Lists

Use for hands-on exercises where users should check off steps:

```markdown
Try this exercise:

- [ ] Navigate to TP53
- [ ] Zoom in twice
- [ ] Filter to show exons only
- [ ] Take a screenshot
```

---

## UI References

### Buttons and Controls
- Use **bold** for clickable elements: "Click **Zoom In**"
- Use exact text as shown in UI
- Describe location if not obvious: "the **Settings** button (gear icon in header)"

### Themes
- Default is light theme - write for light theme unless specifically about themes
- Don't describe colors that change with theme; describe position/function

### Screenshots
- **Do not include screenshots** - they become outdated quickly
- Use precise text descriptions instead
- If a visual is essential, describe what the user should see

---

## Audience Definitions

Each tutorial targets a specific audience. Use these definitions:

| Audience | Description | Assumes |
|----------|-------------|---------|
| **First-time user** | Never used a genome browser | Basic biology knowledge |
| **Bench biologist** | Lab scientist, not computational | Knows genes, coordinates |
| **Bioinformatician** | Computational, command-line comfortable | Knows file formats, scripting |
| **Domain expert** | Deep knowledge in specific area | May use non-model organisms |
| **Power user** | Wants advanced features, reproducibility | Comfortable with all basics |

---

## Versioning

Every tutorial must include version info in the header:

```markdown
> **Last updated**: Session 23 (2026-01-22)
```

Update this whenever the tutorial content changes substantively.

---

## Test Data URLs

Use these R2-hosted files for examples (all E. coli K-12 unless noted):

| Format | URL |
|--------|-----|
| VCF | `https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.vcf.gz` |
| GFF | `https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.gff3.gz` |
| BED | `https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.bed.gz` |
| BAM | `https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.bam` |

For human examples, use GRCh38 coordinates for well-known genes (TP53, BRCA1, etc.).

---

## Checklist Before Publishing

- [ ] Follows document structure (header, What You'll Learn, Try It, Summary)
- [ ] Audience clearly defined in header
- [ ] All UI references match current application
- [ ] All URLs tested and working
- [ ] GQL examples tested and working
- [ ] No screenshots (text descriptions only)
- [ ] Version/session number in header
- [ ] Uses GitHub alerts appropriately (`[!TIP]`, `[!NOTE]`, `[!WARNING]`, etc.)
- [ ] Long reference sections in collapsible `<details>` blocks
- [ ] Exercise solutions in collapsible blocks
- [ ] Spelling and grammar checked

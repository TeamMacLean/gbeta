# Tutorial 8: Customizing Themes and Colors

> **Audience**: All users, especially those needing accessibility features or publication-ready output
> **Time**: 10-15 minutes
> **Prerequisites**: None
> **Last updated**: Session 23 (2026-01-22)

## What You'll Learn

- Switching between Light, Dark, and High-Contrast themes
- Choosing colorblind-safe palettes
- Understanding when to use each theme
- Preparing views for publication and print
- How settings persist across sessions

---

## Why Customize Appearance?

Different situations call for different visual settings:

- **Presentations**: High contrast for projectors
- **Publications**: Light theme for print
- **Long sessions**: Dark theme to reduce eye strain
- **Accessibility**: High-contrast for visual impairments
- **Colorblindness**: Specific palettes that work for everyone

gBeta provides flexible theming so you can work comfortably in any context.

---

## Opening Settings

1. Click the **Settings** button (gear icon) in the header
2. Click the **Display** tab
3. You'll see options for Theme, Color Palette, and Gene Model Style

> [!TIP]
> The Display tab remembers your last view, so you can quickly access it again.

---

## Theme Modes

gBeta offers three themes, each designed for specific use cases.

### Light (Default)

- Clean white background
- Dark text for maximum readability
- **Best for**: Print, publications, daytime use
- Screenshots are publication-ready

This is gBeta's default theme. It provides the highest contrast for printed materials and works well in bright environments.

### Dark

- Dark background with light elements
- Reduces eye strain in low light
- **Best for**: Evening work, long sessions, personal preference
- Note: May need adjustment for print

Dark theme is easier on the eyes during extended sessions or when working in dimly lit environments.

### High-Contrast

- Maximum contrast between elements
- Bold borders and text
- **Best for**: Accessibility needs, presentations on projectors
- Meets WCAG accessibility guidelines

High-Contrast theme is designed for users who need maximum visibility, whether due to visual impairments or challenging viewing conditions like projectors in bright rooms.

> [!TIP]
> Use Light theme for publication figures - it's print-ready with maximum contrast.

<details>
<summary>When to use each theme</summary>

| Situation | Recommended Theme |
|-----------|-------------------|
| Publication figures | Light |
| Presentations (projector) | High-Contrast |
| Working in low light | Dark |
| Long analysis sessions | Dark |
| Accessibility needs | High-Contrast |
| Default/general use | Light |

</details>

---

## Color Palettes

All palettes are **colorblind-safe**, designed using ColorBrewer principles. You can choose any palette with confidence that your colleagues will be able to distinguish features regardless of their color vision.

### Set2 (Default)

- Soft, pastel-like colors
- Good differentiation between categories
- Easy on the eyes for long viewing
- **Best for**: General use, most situations

### Dark2

- Bolder, more saturated colors
- Higher contrast between categories
- Stands out more on slides
- **Best for**: Presentations, when colors need to "pop"

### Paired

- Colors come in light/dark pairs
- Useful for related categories
- Good for comparing groups
- **Best for**: Paired data, before/after comparisons

### Palette Preview

When you select a palette, a preview shows the first 8 colors below the selector. This helps you understand how features will appear in your tracks.

> [!TIP]
> All three palettes are colorblind-safe. Choose based on aesthetic preference.

---

## Gene Model Style

Separate from color palette, you can change how gene models render:

### Arrow (Default)

- Clean, modern look
- Strand indicated by arrow direction
- Good for most uses

### Classic

- Traditional genome browser style
- Peaked introns (hat shape)
- Familiar to IGV/JBrowse users

Choose the style that matches your visual preference or matches the conventions of your field.

---

## Accessibility

gBeta is designed with accessibility in mind.

### Color Vision Deficiency

All palettes work for:
- **Protanopia** (red-blind)
- **Deuteranopia** (green-blind)
- **Tritanopia** (blue-blind)

> [!NOTE]
> gBeta uses shape (chevrons, arrows) not just color to indicate strand direction.

We use **shape and position**, not just color, to convey information:
- Strand direction shown by chevrons/arrows
- Feature types distinguished by position and shape

### Visual Impairment

High-Contrast theme provides:
- Maximum contrast ratios (WCAG AAA where possible)
- Bold borders on all elements
- Large, clear text

<details>
<summary>Accessibility features in detail</summary>

**Color vision support:**
- All palettes tested with protanopia, deuteranopia, and tritanopia simulations
- Shape and position convey information, not just color

**Visual impairment support:**
- High-Contrast theme meets WCAG AAA contrast ratios
- Bold borders on all interactive elements
- Clear, readable text at all sizes

**Testing tools we use:**
- Coblis colorblind simulator
- WCAG contrast checker
- Screen reader compatibility testing

</details>

---

## Preparing for Print

For publication-ready figures, follow these guidelines.

### Recommended Settings

1. Theme: **Light**
2. Palette: **Set2** or **Dark2**
3. Zoom to show desired region clearly

### Taking Screenshots

1. Set up your view (navigate, zoom, filter)
2. Use your browser's screenshot feature or OS screenshot tool
3. Light theme ensures good print contrast

### Export Tips

- Higher zoom = more detail in export
- Consider your final figure size when choosing zoom level
- Light backgrounds work better for most journals

---

## How Settings Are Saved

Your display preferences are saved automatically.

### What's Saved

- Theme mode (Light/Dark/High-Contrast)
- Color palette (Set2/Dark2/Paired)
- Gene model style

> [!IMPORTANT]
> Settings are saved in browser localStorage and persist across sessions.

### Where It's Saved

Settings are stored in your browser's **localStorage**:
- Persists across browser sessions
- Specific to this browser/computer
- Clearing browser data will reset to defaults

> [!NOTE]
> Settings are browser-specific. Different browsers or devices will have separate settings.

### Sharing Settings

Currently, settings are **not** encoded in URLs. When sharing views with collaborators, note your settings:

```
View URL: https://teammaclean.github.io/gbetter/?chr=chr17&start=7668421&end=7687490
Settings: Light theme, Set2 palette
```

---

## Try It Yourself

### Compare Themes

- [ ] Open **Settings > Display**
- [ ] Try each theme - watch the interface change
- [ ] Notice how the canvas, sidebar, and header all adapt

### Test Colorblind Safety

- [ ] Switch to each palette
- [ ] Load a GFF track with multiple feature types
- [ ] Verify you can distinguish all feature types

### Prepare a Publication Figure

- [ ] Set theme to **Light**
- [ ] Navigate to your gene of interest:
  ```
  navigate chr17:7668421-7687490
  ```
- [ ] Zoom to show gene structure clearly
- [ ] Filter to exons:
  ```
  filter type=exon
  ```
- [ ] Take a screenshot - it's publication-ready!

### Accessibility Check

- [ ] Switch to **High-Contrast** theme
- [ ] Navigate around the genome
- [ ] Notice the bold borders and maximum contrast
- [ ] This is how gBeta looks for users who need accessibility features

---

## Summary

You now know how to:

- **Switch themes**: Use Light for print, Dark for extended sessions, High-Contrast for accessibility
- **Choose palettes**: All three (Set2, Dark2, Paired) are colorblind-safe
- **Adjust gene model style**: Arrow (modern) or Classic (traditional)
- **Prepare publication figures**: Light theme with good zoom produces print-ready screenshots
- **Understand persistence**: Settings save to localStorage and persist across sessions

---

## Next Steps

- Explore the **AI Settings** tab to configure natural language queries
- Try loading different file formats to see how themes affect various track types
- Share your publication-ready figures with collaborators

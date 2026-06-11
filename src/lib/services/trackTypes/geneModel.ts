/**
 * Gene Model Track Type (GFF3)
 * Uses the centralized palette system for colors
 */

import type { TrackTypeConfig, RenderContext, ParseResult, GeneModelFeature } from '$lib/types/tracks';
import type { Viewport } from '$lib/types/genome';
import { theme } from '$lib/stores/theme.svelte';
import { INTRON_COLORS } from '$lib/services/palette';

// =============================================================================
// STYLE CONFIGURATION
// =============================================================================

interface GeneModelStyle {
	// Dimensions
	cdsHeight: number;
	utrHeight: number;
	exonHeight: number;
	intronHeight: number;
	rowHeight: number;
	labelHeight: number;
	cornerRadius: number;
	// Style options (geometry, not colors)
	useGlow: boolean;
	useGradients: boolean;
	useInnerChevrons: boolean;
	intronStyle: 'peaked' | 'flat' | 'dashed';
}

// Default style - can be toggled via settings
const DEFAULT_STYLE: GeneModelStyle = {
	cdsHeight: 16,
	utrHeight: 8,
	exonHeight: 12,
	intronHeight: 2,
	rowHeight: 26,
	labelHeight: 18,
	cornerRadius: 4,
	useGlow: false, // Disabled for cleaner look with new palette
	useGradients: false, // Flat style default
	useInnerChevrons: true,
	intronStyle: 'peaked',
};

// Current style (mutable for settings)
let currentStyle: GeneModelStyle = { ...DEFAULT_STYLE };

/**
 * Get colors from the active palette
 */
function getColors() {
	const palette = theme.palette;
	const isDark = theme.isDark;
	const isHighContrast = theme.isHighContrast;

	// Get intron color based on theme
	const intronColor = isDark ? INTRON_COLORS.dark : INTRON_COLORS.light;

	// Chevron color - semi-transparent white on dark, black on light
	const chevronColor = isDark
		? 'rgba(255, 255, 255, 0.4)'
		: 'rgba(0, 0, 0, 0.3)';

	// Label colors
	const labelColor = isDark ? '#f1f5f9' : '#1f2937';
	const labelSecondary = isDark ? '#94a3b8' : '#6b7280';
	const labelBg = isDark
		? 'rgba(15, 23, 42, 0.75)'
		: 'rgba(255, 255, 255, 0.85)';

	// Create color definitions from palette
	const cds = {
		fill: palette.cds,
		stroke: adjustColor(palette.cds, -20),
		glow: isHighContrast ? undefined : `${palette.cds}40`,
	};

	const utr = {
		fill: palette.utr,
		stroke: adjustColor(palette.utr, -20),
		glow: isHighContrast ? undefined : `${palette.utr}30`,
	};

	const exon = {
		fill: palette.exon,
		stroke: adjustColor(palette.exon, -20),
		glow: isHighContrast ? undefined : `${palette.exon}35`,
	};

	const gene = {
		fill: palette.gene,
		stroke: adjustColor(palette.gene, -20),
		glow: isHighContrast ? undefined : `${palette.gene}35`,
	};

	return {
		cds,
		utr,
		exon,
		gene,
		intron: intronColor,
		chevronColor,
		label: labelColor,
		labelSecondary,
		labelBg,
	};
}

/**
 * Simple color adjustment (darken/lighten)
 * Positive amount = lighten, negative = darken
 */
function adjustColor(hex: string, amount: number): string {
	// Parse hex color
	const num = parseInt(hex.slice(1), 16);
	const r = Math.max(0, Math.min(255, (num >> 16) + amount));
	const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
	const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// =============================================================================
// LEGACY API (for backward compatibility)
// =============================================================================

/**
 * Set gene model style (legacy API - now affects geometry only)
 * @deprecated Use theme store for colors, this only affects geometry
 */
export function setGeneModelTheme(themeName: string): void {
	// Legacy themes mapped to geometry settings
	if (themeName === 'dark') {
		currentStyle = {
			...DEFAULT_STYLE,
			useGlow: true,
			useGradients: true,
		};
	} else if (themeName === 'flat') {
		currentStyle = {
			...DEFAULT_STYLE,
			useGlow: false,
			useGradients: false,
			cornerRadius: 2,
		};
	}
}

/**
 * Get available style names (legacy API)
 * @deprecated Theme names are now just geometry presets
 */
export function getGeneModelThemes(): string[] {
	return ['flat', 'dark'];
}

/**
 * Get current theme name (legacy API)
 * @deprecated
 */
export function getCurrentThemeName(): string {
	return currentStyle.useGradients ? 'dark' : 'flat';
}

/**
 * Get current style
 */
export function getCurrentStyle(): GeneModelStyle {
	return currentStyle;
}

/**
 * Get theme-like object for backward compatibility
 * Used by TrackView.svelte for label rendering
 */
export function getCurrentTheme() {
	const colors = getColors();
	return {
		...currentStyle,
		...colors,
		// Map old interface properties to new
		gene: colors.gene,
		cds: colors.cds,
		utr: colors.utr,
		exon: colors.exon,
	};
}

// Export types
export type { GeneModelStyle };

// =============================================================================
// EXPORTED DRAWING HELPERS (for BigBed and other renderers)
// =============================================================================

export { roundedRect, drawPill, drawIntronConnector, drawInnerChevrons };

function parseGff3(content: string): ParseResult<GeneModelFeature> {
	const features: GeneModelFeature[] = [];
	const errors: string[] = [];
	const lines = content.split(/\r?\n/);
	const byId = new Map<string, GeneModelFeature>();
	let featureId = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith('#')) continue;
		if (line.startsWith('>')) break; // FASTA section

		const fields = line.split('\t');
		if (fields.length !== 9) {
			errors.push(`Line ${i + 1}: Expected 9 fields`);
			continue;
		}

		const [seqid, _source, type, startStr, endStr, _scoreStr, strandStr, _phaseStr, attrStr] = fields;

		// Convert 1-based to 0-based
		const start = parseInt(startStr, 10) - 1;
		const end = parseInt(endStr, 10);

		if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
			errors.push(`Line ${i + 1}: Invalid coordinates`);
			continue;
		}

		// Parse attributes. Split on the FIRST '=' only (values may contain '='),
		// and never let a single malformed %-escape crash the whole track load.
		const attrs: Record<string, string> = {};
		for (const pair of attrStr.split(';')) {
			const eq = pair.indexOf('=');
			if (eq === -1) continue; // bare key with no value
			const key = pair.slice(0, eq).trim();
			const rawValue = pair.slice(eq + 1).trim();
			if (!key) continue;
			try {
				attrs[key] = decodeURIComponent(rawValue);
			} catch {
				attrs[key] = rawValue; // malformed URL-encoding: keep the raw value
			}
		}

		// Map GFF3 types to our types
		let featureType: GeneModelFeature['featureType'] = 'exon';
		const lowerType = type.toLowerCase();
		if (lowerType === 'gene') featureType = 'gene';
		else if (lowerType === 'mrna' || lowerType === 'transcript') featureType = 'mRNA';
		else if (lowerType === 'cds') featureType = 'CDS';
		else if (lowerType === 'exon') featureType = 'exon';
		else if (lowerType === 'five_prime_utr' || lowerType === "5'utr") featureType = 'five_prime_UTR';
		else if (lowerType === 'three_prime_utr' || lowerType === "3'utr") featureType = 'three_prime_UTR';
		else if (lowerType === 'utr') featureType = 'UTR';

		const feature: GeneModelFeature = {
			id: attrs['ID'] || `gff_${featureId++}`,
			chromosome: seqid,
			start,
			end,
			name: attrs['Name'] || attrs['gene_name'] || attrs['ID'],
			strand: (strandStr === '+' || strandStr === '-') ? strandStr : '.',
			featureType,
			parent: attrs['Parent'],
			children: [],
			geneId: attrs['gene_id'],
			transcriptId: attrs['transcript_id'],
			attributes: attrs,
		};

		if (attrs['ID']) {
			byId.set(attrs['ID'], feature);
		}

		features.push(feature);
	}

	// Build parent-child relationships
	for (const feature of features) {
		if (feature.parent) {
			const parentIds = feature.parent.split(',');
			for (const pid of parentIds) {
				const parent = byId.get(pid.trim());
				if (parent) {
					parent.children.push(feature);
				}
			}
		}
	}

	return { features, errors };
}

function renderGeneModels(features: GeneModelFeature[], ctx: RenderContext): void {
	const { ctx: c, viewport, toPixelX, trackY, trackHeight, basesPerPixel, dimmedIds } = ctx;
	const style = currentStyle;
	const colors = getColors();

	// Get top-level features (genes or transcripts without parents)
	const topLevel = features.filter(f =>
		f.chromosome === viewport.chromosome &&
		f.end > viewport.start &&
		f.start < viewport.end &&
		!f.parent
	);

	// If no top-level, fall back to all visible features
	const toRender = topLevel.length > 0 ? topLevel : features.filter(f =>
		f.chromosome === viewport.chromosome &&
		f.end > viewport.start &&
		f.start < viewport.end
	);

	// Row packing for genes/transcripts
	const rows: GeneModelFeature[][] = [];
	const padding = 20 * basesPerPixel;

	for (const feature of toRender) {
		let placed = false;
		for (const row of rows) {
			const last = row[row.length - 1];
			if (feature.start >= last.end + padding) {
				row.push(feature);
				placed = true;
				break;
			}
		}
		if (!placed) rows.push([feature]);
	}

	const maxRows = Math.floor((trackHeight - style.labelHeight) / (style.rowHeight + style.labelHeight));
	const displayRows = rows.slice(0, maxRows);

	// Render each row
	for (let rowIdx = 0; rowIdx < displayRows.length; rowIdx++) {
		const baseY = trackY + style.labelHeight + rowIdx * (style.rowHeight + style.labelHeight);

		for (const gene of displayRows[rowIdx]) {
			renderGeneOrTranscript(c, gene, viewport, toPixelX, baseY, basesPerPixel, dimmedIds, style, colors);
		}
	}

	// Overflow indicator
	if (rows.length > maxRows) {
		c.fillStyle = colors.labelSecondary;
		c.font = '9px Inter, sans-serif';
		c.textAlign = 'right';
		c.fillText(`+${rows.length - maxRows} genes`, ctx.canvasWidth - 8, trackY + trackHeight - 4);
	}
}

// =============================================================================
// DRAWING HELPERS
// =============================================================================

interface ColorDef {
	fill: string;
	stroke: string;
	glow?: string;
}

/**
 * Draw a rounded rectangle (pill shape)
 */
function roundedRect(
	c: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
): void {
	const r = Math.min(radius, height / 2, width / 2);
	c.beginPath();
	c.moveTo(x + r, y);
	c.lineTo(x + width - r, y);
	c.quadraticCurveTo(x + width, y, x + width, y + r);
	c.lineTo(x + width, y + height - r);
	c.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
	c.lineTo(x + r, y + height);
	c.quadraticCurveTo(x, y + height, x, y + height - r);
	c.lineTo(x, y + r);
	c.quadraticCurveTo(x, y, x + r, y);
	c.closePath();
}

/**
 * Draw a pill with style-aware rendering
 */
function drawPill(
	c: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	colorDef: ColorDef,
	addGlow: boolean = true
): void {
	if (width < 1) width = 1;
	const style = currentStyle;

	// Add glow effect if style supports it
	if (style.useGlow && addGlow && colorDef.glow && width > 4) {
		c.save();
		c.shadowColor = colorDef.glow;
		c.shadowBlur = 8;
		c.shadowOffsetY = 2;
		roundedRect(c, x, y, width, height, style.cornerRadius);
		c.fillStyle = colorDef.fill;
		c.fill();
		c.restore();
	}

	// Fill - gradient or solid based on style
	roundedRect(c, x, y, width, height, style.cornerRadius);
	if (style.useGradients && width > 6) {
		const gradient = c.createLinearGradient(x, y, x, y + height);
		gradient.addColorStop(0, adjustColor(colorDef.fill, 20));
		gradient.addColorStop(0.5, colorDef.fill);
		gradient.addColorStop(1, adjustColor(colorDef.fill, -20));
		c.fillStyle = gradient;
	} else {
		c.fillStyle = colorDef.fill;
	}
	c.fill();

	// Stroke
	if (width > 3) {
		c.strokeStyle = colorDef.stroke;
		c.lineWidth = 1;
		c.stroke();
	}

	// Highlight on top edge (gradient styles only)
	if (style.useGradients && width > 6 && height > 4) {
		const highlightGradient = c.createLinearGradient(x, y, x, y + height * 0.4);
		highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
		highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
		roundedRect(c, x + 1, y + 1, width - 2, height * 0.4, style.cornerRadius - 1);
		c.fillStyle = highlightGradient;
		c.fill();
	}
}

/**
 * Draw intron connector between exons
 * Supports: 'peaked' (GBrowse hat style), 'flat' (straight line), 'dashed' (dashed line)
 */
function drawIntronConnector(
	c: CanvasRenderingContext2D,
	startX: number,
	endX: number,
	centerY: number,
	exonHeight: number
): void {
	const width = endX - startX;
	if (width < 2) return;

	const style = currentStyle;
	const colors = getColors();
	c.strokeStyle = colors.intron;
	c.lineWidth = 1.5;
	c.lineCap = 'round';
	c.lineJoin = 'round';

	if (style.intronStyle === 'peaked') {
		// GBrowse-style peaked intron (hat shape)
		const peakHeight = Math.min(exonHeight * 0.6, 8);
		const midX = (startX + endX) / 2;
		const peakY = centerY - peakHeight;

		c.beginPath();
		c.moveTo(startX, centerY);
		c.lineTo(midX, peakY);
		c.lineTo(endX, centerY);
		c.stroke();
	} else if (style.intronStyle === 'dashed') {
		// Dashed line
		c.setLineDash([4, 3]);
		c.beginPath();
		c.moveTo(startX, centerY);
		c.lineTo(endX, centerY);
		c.stroke();
		c.setLineDash([]);
	} else {
		// Flat solid line
		c.beginPath();
		c.moveTo(startX, centerY);
		c.lineTo(endX, centerY);
		c.stroke();
	}
}

/**
 * Draw inner chevrons to indicate strand direction inside exons/CDS
 */
function drawInnerChevrons(
	c: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	strand: '+' | '-' | '.'
): void {
	if (!currentStyle.useInnerChevrons) return;
	if (strand === '.' || width < 20) return;

	const chevronSpacing = 12;
	const chevronSize = Math.min(4, height * 0.25);
	const centerY = y + height / 2;

	const colors = getColors();
	c.strokeStyle = colors.chevronColor;
	c.lineWidth = 1.5;
	c.lineCap = 'round';
	c.lineJoin = 'round';

	const startOffset = 8;
	const endOffset = 8;

	for (let cx = x + startOffset; cx < x + width - endOffset; cx += chevronSpacing) {
		c.beginPath();
		if (strand === '+') {
			c.moveTo(cx - chevronSize, centerY - chevronSize);
			c.lineTo(cx + chevronSize * 0.5, centerY);
			c.lineTo(cx - chevronSize, centerY + chevronSize);
		} else {
			c.moveTo(cx + chevronSize, centerY - chevronSize);
			c.lineTo(cx - chevronSize * 0.5, centerY);
			c.lineTo(cx + chevronSize, centerY + chevronSize);
		}
		c.stroke();
	}
}

function renderGeneOrTranscript(
	c: CanvasRenderingContext2D,
	feature: GeneModelFeature,
	viewport: Viewport,
	toPixelX: (pos: number) => number,
	baseY: number,
	_basesPerPixel: number,
	dimmedIds: Set<string> | undefined,
	style: GeneModelStyle,
	colors: ReturnType<typeof getColors>,
	skipLabel?: boolean
): void {
	const x = toPixelX(feature.start);
	const endX = toPixelX(feature.end);
	const width = Math.max(1, endX - x);

	// Helper to check if a feature should be dimmed
	const isDimmed = (f: GeneModelFeature) => dimmedIds?.has(f.id) ?? false;

	// Get children grouped by type
	const exons = feature.children.filter(ch => ch.featureType === 'exon');
	const cdss = feature.children.filter(ch => ch.featureType === 'CDS');
	const utrs = feature.children.filter(ch =>
		ch.featureType === 'UTR' ||
		ch.featureType === 'five_prime_UTR' ||
		ch.featureType === 'three_prime_UTR'
	);

	// If this has transcripts as children, render the first transcript's structure
	const transcripts = feature.children.filter(ch => ch.featureType === 'mRNA');
	if (transcripts.length > 0) {
		const transcript = transcripts[0];
		// Pass skipLabel=true to prevent transcript from drawing its own label
		renderGeneOrTranscript(c, transcript, viewport, toPixelX, baseY, _basesPerPixel, dimmedIds, style, colors, true);

		// Draw gene label above (only the gene label, not transcript)
		if (feature.name && width > 20) {
			c.fillStyle = colors.label;
			c.font = '600 10px Inter, system-ui, sans-serif';
			c.textAlign = 'left';
			c.fillText(feature.name, x, baseY - 4);
		}
		return;
	}

	const centerY = baseY + style.rowHeight / 2;
	const strand = feature.strand ?? '.';

	// Collect all exon-like regions for intron drawing
	const allExonRegions = [...exons, ...cdss, ...utrs]
		.sort((a, b) => a.start - b.start);

	// Draw intron connectors between exons (peaked style)
	if (allExonRegions.length > 1) {
		for (let i = 0; i < allExonRegions.length - 1; i++) {
			const current = allExonRegions[i];
			const next = allExonRegions[i + 1];
			const intronStart = toPixelX(current.end);
			const intronEnd = toPixelX(next.start);
			if (intronEnd > intronStart + 2) {
				drawIntronConnector(c, intronStart, intronEnd, centerY, style.cdsHeight);
			}
		}
	} else if (width > 10 && allExonRegions.length === 0) {
		// Single span with no structure - draw line
		drawIntronConnector(c, x, x + width, centerY, style.exonHeight);
	}

	// Helper to apply dimming for a feature
	const withDimming = (f: GeneModelFeature, draw: () => void) => {
		if (isDimmed(f)) {
			c.save();
			c.globalAlpha = 0.25;
			draw();
			c.restore();
		} else {
			draw();
		}
	};

	// If we have CDS and exons, draw with filter-aware layering
	if (cdss.length > 0 && exons.length > 0) {
		// Separate dimmed and visible features
		const dimmedExons = exons.filter(isDimmed);
		const visibleExons = exons.filter(e => !isDimmed(e));
		const dimmedCds = cdss.filter(isDimmed);
		const visibleCds = cdss.filter(cds => !isDimmed(cds));

		// FIRST PASS: Draw all dimmed features (behind)
		c.save();
		c.globalAlpha = 0.25;

		// Dimmed exons as UTR style
		for (const exon of dimmedExons) {
			const ex = toPixelX(exon.start);
			const ew = Math.max(1, toPixelX(exon.end) - ex);
			const ey = centerY - style.utrHeight / 2;
			drawPill(c, ex, ey, ew, style.utrHeight, colors.utr, false);
		}

		// Dimmed CDS
		for (const cds of dimmedCds) {
			const cx = toPixelX(cds.start);
			const cw = Math.max(1, toPixelX(cds.end) - cx);
			const cy = centerY - style.cdsHeight / 2;
			drawPill(c, cx, cy, cw, style.cdsHeight, colors.cds);
			drawInnerChevrons(c, cx, cy, cw, style.cdsHeight, strand);
		}

		c.restore();

		// SECOND PASS: Draw visible features on top
		// Visible exons - draw as proper exons (not UTR style) when CDS is dimmed
		for (const exon of visibleExons) {
			const ex = toPixelX(exon.start);
			const ew = Math.max(1, toPixelX(exon.end) - ex);
			// Use full exon style if CDS is being filtered out
			if (dimmedCds.length > 0 && visibleCds.length === 0) {
				const ey = centerY - style.exonHeight / 2;
				drawPill(c, ex, ey, ew, style.exonHeight, colors.exon);
				drawInnerChevrons(c, ex, ey, ew, style.exonHeight, strand);
			} else {
				// Normal UTR style when both visible
				const ey = centerY - style.utrHeight / 2;
				drawPill(c, ex, ey, ew, style.utrHeight, colors.utr, false);
			}
		}

		// Visible CDS on top
		for (const cds of visibleCds) {
			const cx = toPixelX(cds.start);
			const cw = Math.max(1, toPixelX(cds.end) - cx);
			const cy = centerY - style.cdsHeight / 2;
			drawPill(c, cx, cy, cw, style.cdsHeight, colors.cds);
			drawInnerChevrons(c, cx, cy, cw, style.cdsHeight, strand);
		}
	} else if (exons.length > 0) {
		// Just exons with inner chevrons
		for (const exon of exons) {
			withDimming(exon, () => {
				const ex = toPixelX(exon.start);
				const ew = Math.max(1, toPixelX(exon.end) - ex);
				const ey = centerY - style.exonHeight / 2;
				drawPill(c, ex, ey, ew, style.exonHeight, colors.exon);
				drawInnerChevrons(c, ex, ey, ew, style.exonHeight, strand);
			});
		}
	} else if (cdss.length > 0) {
		// Just CDS with inner chevrons
		for (const cds of cdss) {
			withDimming(cds, () => {
				const cx = toPixelX(cds.start);
				const cw = Math.max(1, toPixelX(cds.end) - cx);
				const cy = centerY - style.cdsHeight / 2;
				drawPill(c, cx, cy, cw, style.cdsHeight, colors.cds);
				drawInnerChevrons(c, cx, cy, cw, style.cdsHeight, strand);
			});
		}
	} else if (utrs.length > 0) {
		// Just UTRs
		for (const utr of utrs) {
			withDimming(utr, () => {
				const ux = toPixelX(utr.start);
				const uw = Math.max(1, toPixelX(utr.end) - ux);
				drawPill(c, ux, centerY - style.utrHeight / 2, uw, style.utrHeight, colors.utr);
			});
		}
	} else {
		// No children - draw as single pill with chevrons (check parent feature)
		withDimming(feature, () => {
			const gy = centerY - style.exonHeight / 2;
			drawPill(c, x, gy, width, style.exonHeight, colors.gene);
			drawInnerChevrons(c, x, gy, width, style.exonHeight, strand);
		});
	}

	// Draw label with modern typography and subtle background (skip if parent handles it)
	if (feature.name && width > 25 && !skipLabel) {
		c.font = '600 10px Inter, system-ui, sans-serif';
		c.textAlign = 'left';

		let label = feature.name;
		const maxWidth = width - 6;
		const textWidth = c.measureText(label).width;

		if (textWidth > maxWidth) {
			while (label.length > 3 && c.measureText(label + '…').width > maxWidth) {
				label = label.slice(0, -1);
			}
			label += '…';
		}

		const labelX = x + 2;
		const labelY = baseY - 4;
		const measuredWidth = c.measureText(label).width;

		// Subtle background pill for label
		if (measuredWidth > 10) {
			c.fillStyle = colors.labelBg;
			roundedRect(c, labelX - 3, labelY - 10, measuredWidth + 6, 13, 3);
			c.fill();
		}

		c.fillStyle = colors.label;
		c.fillText(label, labelX, labelY, maxWidth);
	}
}

export const geneModelTrackType: TrackTypeConfig<GeneModelFeature> = {
	id: 'gene-model',
	name: 'Gene Models (GFF3)',
	extensions: ['gff', 'gff3', 'gtf'],
	style: 'gene-model',
	defaultHeight: 100,
	zoomBehavior: 'collapse',
	parse: parseGff3,
	render: renderGeneModels,
};

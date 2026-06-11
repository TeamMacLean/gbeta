/**
 * Variant Track Type (VCF)
 * Zoom-dependent visualization: density → lollipops → ref/alt
 * At high zoom, shows variants in reference sequence context
 */

import type { TrackTypeConfig, RenderContext, ParseResult, VariantFeature } from '$lib/types/tracks';
import type { Viewport } from '$lib/types/genome';
import { ZOOM_THRESHOLDS, BASE_COLORS, shouldShowSequence } from '$lib/constants/zoom';
import { getReferenceSequence } from '$lib/stores/referenceSequence.svelte';

// Thresholds for display modes
const DENSITY_THRESHOLD = 0.1;    // bases per pixel - show density heatmap
const LOLLIPOP_THRESHOLD = 5;     // bases per pixel - show lollipops
// Below LOLLIPOP_THRESHOLD - show ref/alt text

// Colors for variant types
const VARIANT_COLORS = {
	snp: '#3b82f6',        // blue
	insertion: '#22c55e',  // green
	deletion: '#ef4444',   // red
	mnp: '#f59e0b',        // amber
	complex: '#8b5cf6',    // violet
};

function parseVcf(content: string): ParseResult<VariantFeature> {
	const features: VariantFeature[] = [];
	const errors: string[] = [];
	const lines = content.split(/\r?\n/);
	let featureId = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith('#')) continue;

		const fields = line.split('\t');
		if (fields.length < 5) {
			errors.push(`Line ${i + 1}: Expected at least 5 fields`);
			continue;
		}

		const [chrom, posStr, id, ref, altStr, qualStr, filter, infoStr] = fields;
		const pos = parseInt(posStr, 10) - 1; // VCF is 1-based

		if (isNaN(pos) || pos < 0) {
			errors.push(`Line ${i + 1}: Invalid position`);
			continue;
		}

		// REF/ALT must be present. ALT may be '.' (no alternate allele) but not empty.
		if (!ref || !altStr || altStr.trim() === '') {
			errors.push(`Line ${i + 1}: missing REF/ALT`);
			continue;
		}

		const alt = altStr.split(',');
		const end = pos + ref.length;

		// Parse INFO field
		const info: Record<string, string> = {};
		if (infoStr && infoStr !== '.') {
			for (const pair of infoStr.split(';')) {
				const [key, value] = pair.split('=');
				info[key] = value || 'true';
			}
		}

		features.push({
			id: id !== '.' ? id : `var_${featureId++}`,
			// Only add a 'chr' prefix for UCSC-style names (1-22, X, Y, M, MT).
			// Blindly prepending broke accessions (NC_000913.3 -> chrNC_000913.3).
			// Cross-assembly name normalization (e.g. bare "1" on a non-UCSC
			// assembly) is a track-validation-layer concern, not a per-parser hack.
			chromosome:
				!chrom.startsWith('chr') && /^([0-9]+|[XYM]|MT)$/i.test(chrom)
					? `chr${chrom}`
					: chrom,
			start: pos,
			end,
			name: id !== '.' ? id : `${ref}>${alt[0]}`,
			ref,
			alt,
			qual: qualStr !== '.' ? parseFloat(qualStr) : undefined,
			filter: filter !== '.' ? filter : undefined,
			info,
		});
	}

	return { features, errors };
}

function getVariantType(ref: string, alt: string): keyof typeof VARIANT_COLORS {
	if (ref.length === 1 && alt.length === 1) return 'snp';
	if (ref.length < alt.length) return 'insertion';
	if (ref.length > alt.length) return 'deletion';
	if (ref.length === alt.length && ref.length > 1) return 'mnp';
	return 'complex';
}

function renderVariants(features: VariantFeature[], ctx: RenderContext): void {
	const { ctx: c, viewport, toPixelX, trackY, trackHeight, canvasWidth, basesPerPixel, color } = ctx;

	const visible = features.filter(f =>
		f.chromosome === viewport.chromosome &&
		f.end > viewport.start &&
		f.start < viewport.end
	);

	if (visible.length === 0) return;

	const plotHeight = trackHeight - 20;
	const plotY = trackY + 14;
	const centerY = plotY + plotHeight / 2;

	// Choose rendering mode based on zoom level
	if (basesPerPixel > DENSITY_THRESHOLD * canvasWidth) {
		// Density mode - aggregate into bins
		renderDensity(c, visible, viewport, toPixelX, plotY, plotHeight, canvasWidth, basesPerPixel, color);
	} else if (basesPerPixel > LOLLIPOP_THRESHOLD) {
		// Lollipop mode
		renderLollipops(c, visible, toPixelX, centerY, plotHeight);
	} else {
		// Detailed mode - show ref/alt
		renderDetailed(c, visible, toPixelX, plotY, plotHeight, basesPerPixel);
	}
}

function renderDensity(
	c: CanvasRenderingContext2D,
	features: VariantFeature[],
	viewport: Viewport,
	toPixelX: (pos: number) => number,
	plotY: number,
	plotHeight: number,
	canvasWidth: number,
	basesPerPixel: number,
	color: string
): void {
	// Bin variants into pixels
	const binSize = Math.ceil(basesPerPixel);
	const counts = new Map<number, number>();
	let maxCount = 0;

	for (const v of features) {
		const bin = Math.floor(v.start / binSize);
		const count = (counts.get(bin) || 0) + 1;
		counts.set(bin, count);
		maxCount = Math.max(maxCount, count);
	}

	// Draw heatmap
	for (const [bin, count] of counts) {
		const x = toPixelX(bin * binSize);
		const width = Math.max(1, toPixelX((bin + 1) * binSize) - x);
		const intensity = count / maxCount;
		const height = intensity * plotHeight;

		// Color intensity based on count
		c.fillStyle = `rgba(99, 102, 241, ${0.3 + intensity * 0.7})`;
		c.fillRect(x, plotY + plotHeight - height, width, height);
	}

	// Label
	c.fillStyle = '#666666';
	c.font = '9px Inter, sans-serif';
	c.textAlign = 'left';
	c.fillText(`${features.length} variants (density view)`, 4, plotY + 10);
}

function renderLollipops(
	c: CanvasRenderingContext2D,
	features: VariantFeature[],
	toPixelX: (pos: number) => number,
	centerY: number,
	plotHeight: number
): void {
	const stickHeight = plotHeight * 0.4;
	const headRadius = 3;

	// Draw baseline
	c.strokeStyle = '#333333';
	c.lineWidth = 1;
	c.beginPath();
	c.moveTo(0, centerY);
	c.lineTo(toPixelX(Infinity), centerY);
	c.stroke();

	// Limit to avoid overdraw
	const maxToRender = 500;
	const toRender = features.slice(0, maxToRender);

	for (const v of toRender) {
		const x = toPixelX(v.start);
		const varType = getVariantType(v.ref, v.alt[0]);
		const varColor = VARIANT_COLORS[varType];

		// Stick
		c.strokeStyle = varColor;
		c.lineWidth = 1;
		c.beginPath();
		c.moveTo(x, centerY);
		c.lineTo(x, centerY - stickHeight);
		c.stroke();

		// Head
		c.fillStyle = varColor;
		c.beginPath();
		c.arc(x, centerY - stickHeight, headRadius, 0, Math.PI * 2);
		c.fill();
	}

	if (features.length > maxToRender) {
		c.fillStyle = '#666666';
		c.font = '9px Inter, sans-serif';
		c.textAlign = 'right';
		c.fillText(`Showing ${maxToRender}/${features.length}`, toPixelX(Infinity) - 4, centerY + 12);
	}
}

function renderDetailed(
	c: CanvasRenderingContext2D,
	features: VariantFeature[],
	toPixelX: (pos: number) => number,
	plotY: number,
	plotHeight: number,
	basesPerPixel: number
): void {
	const pixelsPerBase = 1 / basesPerPixel;

	// Check if we should show sequence context
	if (shouldShowSequence(pixelsPerBase)) {
		renderDetailedWithSequence(c, features, toPixelX, plotY, plotHeight, pixelsPerBase);
		return;
	}

	// Standard detailed view (ref>alt boxes)
	const fontSize = Math.min(12, Math.max(8, pixelsPerBase * 0.8));
	c.font = `${fontSize}px monospace`;
	c.textAlign = 'center';
	c.textBaseline = 'middle';

	const centerY = plotY + plotHeight / 2;
	const boxHeight = fontSize + 4;

	for (const v of features) {
		const x = toPixelX(v.start);
		const varType = getVariantType(v.ref, v.alt[0]);
		const varColor = VARIANT_COLORS[varType];

		// Background box
		const text = `${v.ref}>${v.alt[0]}`;
		const textWidth = c.measureText(text).width + 6;

		c.fillStyle = varColor + '40';
		c.fillRect(x - textWidth / 2, centerY - boxHeight / 2, textWidth, boxHeight);

		c.strokeStyle = varColor;
		c.lineWidth = 1;
		c.strokeRect(x - textWidth / 2, centerY - boxHeight / 2, textWidth, boxHeight);

		// Text
		c.fillStyle = '#e5e5e5';
		c.fillText(text, x, centerY);

		// Variant ID if room
		if (v.name && basesPerPixel < 1 && v.name !== text) {
			c.fillStyle = '#888888';
			c.font = '8px Inter, sans-serif';
			c.fillText(v.name, x, centerY - boxHeight / 2 - 6);
			c.font = `${fontSize}px monospace`;
		}
	}
}

/**
 * Render variants with reference sequence context at high zoom
 * Shows reference bases with variant positions highlighted
 */
function renderDetailedWithSequence(
	c: CanvasRenderingContext2D,
	features: VariantFeature[],
	toPixelX: (pos: number) => number,
	plotY: number,
	plotHeight: number,
	pixelsPerBase: number
): void {
	const referenceSequence = getReferenceSequence();
	const refSeq = referenceSequence.sequence;
	const refStart = referenceSequence.start;
	const refEnd = referenceSequence.end;

	// Calculate font size based on zoom
	const fontSize = Math.min(14, Math.max(8, pixelsPerBase * 0.8));
	c.font = `bold ${fontSize}px monospace`;
	c.textAlign = 'center';
	c.textBaseline = 'middle';

	const refY = plotY + 14; // Reference row
	const altY = plotY + plotHeight / 2 + 10; // Alt allele row
	const labelHeight = fontSize + 4;

	// Create a map of variant positions for quick lookup
	const variantMap = new Map<number, VariantFeature>();
	for (const v of features) {
		for (let i = 0; i < v.ref.length; i++) {
			variantMap.set(v.start + i, v);
		}
	}

	// Draw reference sequence with variant highlights
	if (refSeq) {
		for (let i = 0; i < refSeq.length; i++) {
			const pos = refStart + i;
			const x = toPixelX(pos) + pixelsPerBase / 2;
			const base = refSeq[i].toUpperCase();
			const variant = variantMap.get(pos);

			if (variant && pos === variant.start) {
				// This is a variant position - highlight it
				const varType = getVariantType(variant.ref, variant.alt[0]);
				const varColor = VARIANT_COLORS[varType];

				// Draw highlight background for reference
				c.fillStyle = varColor + '30';
				const highlightWidth = variant.ref.length * pixelsPerBase;
				c.fillRect(x - pixelsPerBase / 2, refY - labelHeight / 2, highlightWidth, labelHeight);

				// Draw reference base
				c.fillStyle = '#666666'; // Dim the reference
				c.fillText(base, x, refY);

				// Draw alt allele below
				const alt = variant.alt[0];
				c.fillStyle = varColor;
				c.font = `bold ${fontSize}px monospace`;

				// Background for alt
				const altWidth = c.measureText(alt).width + 6;
				c.fillStyle = varColor + '40';
				c.fillRect(x - altWidth / 2, altY - labelHeight / 2, altWidth, labelHeight);

				// Alt text
				c.fillStyle = '#ffffff';
				c.fillText(alt, x, altY);

				// Draw connecting line
				c.strokeStyle = varColor;
				c.lineWidth = 2;
				c.beginPath();
				c.moveTo(x, refY + labelHeight / 2);
				c.lineTo(x, altY - labelHeight / 2);
				c.stroke();

				// Draw variant type indicator
				c.fillStyle = varColor;
				c.font = '8px Inter, sans-serif';
				c.fillText(varType.toUpperCase(), x, plotY + 8);
				c.font = `bold ${fontSize}px monospace`;
			} else if (!variant) {
				// Not a variant position - draw normal reference base
				c.fillStyle = BASE_COLORS[base] || BASE_COLORS.N;
				c.fillText(base, x, refY);
			}
			// Skip bases that are part of a multi-base variant (not the start)
		}
	} else {
		// No reference sequence available - fall back to standard display
		c.fillStyle = '#666666';
		c.font = '10px Inter, sans-serif';
		c.textAlign = 'left';
		c.fillText('Reference sequence not available', 8, plotY + 20);

		// Draw variants without context
		for (const v of features) {
			const x = toPixelX(v.start) + pixelsPerBase / 2;
			const varType = getVariantType(v.ref, v.alt[0]);
			const varColor = VARIANT_COLORS[varType];

			// Background
			const text = `${v.ref}>${v.alt[0]}`;
			const textWidth = c.measureText(text).width + 8;
			c.fillStyle = varColor + '40';
			c.fillRect(x - textWidth / 2, altY - labelHeight / 2, textWidth, labelHeight);

			// Border
			c.strokeStyle = varColor;
			c.lineWidth = 1;
			c.strokeRect(x - textWidth / 2, altY - labelHeight / 2, textWidth, labelHeight);

			// Text
			c.fillStyle = '#ffffff';
			c.font = `${fontSize}px monospace`;
			c.textAlign = 'center';
			c.fillText(text, x, altY);
		}
	}
}

export const variantsTrackType: TrackTypeConfig<VariantFeature> = {
	id: 'variants',
	name: 'Variants (VCF)',
	extensions: ['vcf'],
	style: 'variants',
	defaultHeight: 60,
	zoomBehavior: 'detail-on-zoom',
	parse: parseVcf,
	render: renderVariants,
};

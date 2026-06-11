/**
 * Interval Track Type (BED)
 * Simple rectangular features
 */

import type { TrackTypeConfig, RenderContext, ParseResult } from '$lib/types/tracks';
import type { BedFeature, Viewport } from '$lib/types/genome';

const FEATURE_HEIGHT = 10;
const FEATURE_MARGIN = 2;
const ROW_HEIGHT = FEATURE_HEIGHT + FEATURE_MARGIN * 2;
const ARROW_SIZE = 5;

function parseBed(content: string): ParseResult<BedFeature> {
	const features: BedFeature[] = [];
	const errors: string[] = [];
	const lines = content.split(/\r?\n/);
	let featureId = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith('#') || line.startsWith('track') || line.startsWith('browser')) {
			continue;
		}

		const fields = line.split('\t');
		if (fields.length < 3) {
			errors.push(`Line ${i + 1}: Expected at least 3 fields`);
			continue;
		}

		const start = parseInt(fields[1], 10);
		const end = parseInt(fields[2], 10);

		if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
			errors.push(`Line ${i + 1}: Invalid coordinates`);
			continue;
		}

		const feature: BedFeature = {
			id: `bed_${featureId++}`,
			chromosome: fields[0],
			start,
			end,
			name: fields[3] !== '.' ? fields[3] : undefined,
			score: fields[4] && fields[4] !== '.' ? parseInt(fields[4], 10) : undefined,
			strand: (fields[5] === '+' || fields[5] === '-') ? fields[5] : '.',
		};

		// BED12 block support
		if (fields.length >= 12) {
			const blockCount = parseInt(fields[9], 10);
			if (!isNaN(blockCount) && blockCount > 0) {
				const blockSizes = fields[10].split(',').filter(s => s).map(s => parseInt(s, 10));
				const blockStarts = fields[11].split(',').filter(s => s).map(s => parseInt(s, 10));
				// Only accept block annotations that are internally consistent — a
				// mismatched count would mis-draw the feature's exons.
				if (
					blockSizes.length === blockCount &&
					blockStarts.length === blockCount &&
					blockSizes.every(n => !isNaN(n)) &&
					blockStarts.every(n => !isNaN(n))
				) {
					feature.blockCount = blockCount;
					feature.blockSizes = blockSizes;
					feature.blockStarts = blockStarts;
				} else {
					errors.push(`Line ${i + 1}: BED12 blockCount (${blockCount}) does not match blockSizes/blockStarts`);
				}
			}
		}

		features.push(feature);
	}

	return { features, errors };
}

function renderIntervals(features: BedFeature[], ctx: RenderContext): void {
	const { ctx: c, viewport, toPixelX, trackY, trackHeight, color } = ctx;

	// Filter to visible
	const visible = features.filter(f =>
		f.chromosome === viewport.chromosome &&
		f.end > viewport.start &&
		f.start < viewport.end
	);

	// Row packing
	const rows: BedFeature[][] = [];
	const padding = 5 * ctx.basesPerPixel;

	for (const feature of visible) {
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

	// Limit rows
	const maxRows = Math.floor((trackHeight - 16) / ROW_HEIGHT);
	const displayRows = rows.slice(0, maxRows);

	// Render
	for (let rowIdx = 0; rowIdx < displayRows.length; rowIdx++) {
		const y = trackY + 16 + rowIdx * ROW_HEIGHT + FEATURE_MARGIN;

		for (const feature of displayRows[rowIdx]) {
			const x = toPixelX(feature.start);
			const endX = toPixelX(feature.end);
			const width = Math.max(1, endX - x);

			// Draw blocks if BED12, otherwise simple rect
			if (feature.blockCount && feature.blockSizes && feature.blockStarts) {
				// Draw thin line for intron
				c.strokeStyle = color;
				c.lineWidth = 1;
				c.beginPath();
				c.moveTo(x, y + FEATURE_HEIGHT / 2);
				c.lineTo(x + width, y + FEATURE_HEIGHT / 2);
				c.stroke();

				// Draw blocks
				for (let i = 0; i < feature.blockCount; i++) {
					const blockStart = feature.start + feature.blockStarts[i];
					const blockEnd = blockStart + feature.blockSizes[i];
					const bx = toPixelX(blockStart);
					const bw = Math.max(1, toPixelX(blockEnd) - bx);

					c.fillStyle = color;
					c.fillRect(bx, y, bw, FEATURE_HEIGHT);
				}
			} else {
				c.fillStyle = color;
				c.fillRect(x, y, width, FEATURE_HEIGHT);
			}

			// Strand arrow
			if (feature.strand && feature.strand !== '.' && width > ARROW_SIZE * 2) {
				c.fillStyle = 'rgba(0,0,0,0.3)';
				const arrowY = y + FEATURE_HEIGHT / 2;
				c.beginPath();
				if (feature.strand === '+') {
					c.moveTo(x + width - ARROW_SIZE, y + 2);
					c.lineTo(x + width - 2, arrowY);
					c.lineTo(x + width - ARROW_SIZE, y + FEATURE_HEIGHT - 2);
				} else {
					c.moveTo(x + ARROW_SIZE, y + 2);
					c.lineTo(x + 2, arrowY);
					c.lineTo(x + ARROW_SIZE, y + FEATURE_HEIGHT - 2);
				}
				c.closePath();
				c.fill();
			}

			// Label
			if (feature.name && width > 30) {
				c.fillStyle = '#ffffff';
				c.font = '9px Inter, sans-serif';
				c.textAlign = 'left';
				c.textBaseline = 'middle';
				const maxWidth = width - 8;
				let label = feature.name;
				if (c.measureText(label).width > maxWidth) {
					while (label.length > 3 && c.measureText(label + '…').width > maxWidth) {
						label = label.slice(0, -1);
					}
					label += '…';
				}
				c.fillText(label, x + 4, y + FEATURE_HEIGHT / 2, maxWidth);
			}
		}
	}

	// Overflow indicator
	if (rows.length > maxRows) {
		c.fillStyle = '#666666';
		c.font = '9px Inter, sans-serif';
		c.textAlign = 'right';
		c.fillText(`+${rows.length - maxRows} rows`, ctx.canvasWidth - 8, trackY + trackHeight - 4);
	}
}

export const intervalsTrackType: TrackTypeConfig<BedFeature> = {
	id: 'intervals',
	name: 'Intervals (BED)',
	extensions: ['bed'],
	style: 'intervals',
	defaultHeight: 60,
	zoomBehavior: 'collapse',
	parse: parseBed,
	render: renderIntervals,
};

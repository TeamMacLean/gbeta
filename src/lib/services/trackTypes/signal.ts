/**
 * Signal Track Type (bedGraph)
 * Area chart / histogram visualization for continuous data
 */

import type { TrackTypeConfig, RenderContext, ParseResult, SignalFeature } from '$lib/types/tracks';
import type { Viewport } from '$lib/types/genome';

function parseBedGraph(content: string): ParseResult<SignalFeature> {
	const features: SignalFeature[] = [];
	const errors: string[] = [];
	const lines = content.split(/\r?\n/);
	let featureId = 0;
	let minValue = Infinity;
	let maxValue = -Infinity;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith('#') || line.startsWith('track') || line.startsWith('browser')) {
			continue;
		}

		const fields = line.split(/\s+/);
		if (fields.length < 4) {
			errors.push(`Line ${i + 1}: Expected at least 4 fields`);
			continue;
		}

		// Coordinates must be plain non-negative integers — parseInt would
		// silently truncate "100.5" to 100 and "1e2" to 1.
		if (!/^\d+$/.test(fields[1]) || !/^\d+$/.test(fields[2])) {
			errors.push(`Line ${i + 1}: coordinates must be integers`);
			continue;
		}
		const start = parseInt(fields[1], 10);
		const end = parseInt(fields[2], 10);
		const value = parseFloat(fields[3]);

		if (isNaN(start) || isNaN(end) || !isFinite(value) || start < 0 || end <= start) {
			errors.push(`Line ${i + 1}: Invalid data`);
			continue;
		}

		minValue = Math.min(minValue, value);
		maxValue = Math.max(maxValue, value);

		features.push({
			id: `bg_${featureId++}`,
			chromosome: fields[0],
			start,
			end,
			value,
		});
	}

	return {
		features,
		errors,
		metadata: {
			minValue: minValue === Infinity ? 0 : minValue,
			maxValue: maxValue === -Infinity ? 1 : maxValue,
		},
	};
}

function renderSignal(features: SignalFeature[], ctx: RenderContext): void {
	const { ctx: c, viewport, toPixelX, trackY, trackHeight, canvasWidth, color, basesPerPixel } = ctx;

	// Filter to visible chromosome
	const visible = features.filter(f =>
		f.chromosome === viewport.chromosome &&
		f.end > viewport.start &&
		f.start < viewport.end
	);

	if (visible.length === 0) return;

	// Calculate Y scale (auto-scale to visible data)
	let minVal = Infinity;
	let maxVal = -Infinity;
	for (const f of visible) {
		minVal = Math.min(minVal, f.value);
		maxVal = Math.max(maxVal, f.value);
	}

	// Add padding to range
	const range = maxVal - minVal || 1;
	minVal = Math.min(0, minVal); // Always include 0 if data is positive
	maxVal = maxVal + range * 0.1;

	const plotHeight = trackHeight - 24; // Leave room for label and axis
	const plotY = trackY + 16;

	const valueToY = (val: number): number => {
		const normalized = (val - minVal) / (maxVal - minVal);
		return plotY + plotHeight - (normalized * plotHeight);
	};

	// Draw baseline at 0
	const zeroY = valueToY(0);
	c.strokeStyle = '#333333';
	c.lineWidth = 1;
	c.beginPath();
	c.moveTo(0, zeroY);
	c.lineTo(canvasWidth, zeroY);
	c.stroke();

	// Bin data if too dense
	const binWidth = Math.max(1, Math.ceil(basesPerPixel));
	const bins = new Map<number, { sum: number; count: number }>();

	for (const f of visible) {
		const startBin = Math.floor(f.start / binWidth);
		const endBin = Math.ceil(f.end / binWidth);

		for (let bin = startBin; bin < endBin; bin++) {
			const existing = bins.get(bin) || { sum: 0, count: 0 };
			existing.sum += f.value;
			existing.count += 1;
			bins.set(bin, existing);
		}
	}

	// Create gradient for fill
	const gradient = c.createLinearGradient(0, plotY, 0, plotY + plotHeight);
	gradient.addColorStop(0, color);
	gradient.addColorStop(1, color + '20'); // Fade to transparent

	// Draw as filled area
	c.beginPath();
	c.moveTo(0, zeroY);

	let lastX = 0;
	const sortedBins = Array.from(bins.entries()).sort((a, b) => a[0] - b[0]);

	for (const [bin, data] of sortedBins) {
		const binStart = bin * binWidth;
		const binEnd = binStart + binWidth;

		const x1 = toPixelX(binStart);
		const x2 = toPixelX(binEnd);
		const avgValue = data.sum / data.count;
		const y = valueToY(avgValue);

		if (x1 > lastX + 1) {
			// Gap - go down to zero and back up
			c.lineTo(lastX, zeroY);
			c.lineTo(x1, zeroY);
		}

		c.lineTo(x1, y);
		c.lineTo(x2, y);
		lastX = x2;
	}

	c.lineTo(lastX, zeroY);
	c.closePath();

	c.fillStyle = gradient;
	c.fill();

	// Draw outline
	c.strokeStyle = color;
	c.lineWidth = 1;
	c.beginPath();
	let started = false;

	for (const [bin, data] of sortedBins) {
		const binStart = bin * binWidth;
		const binEnd = binStart + binWidth;
		const x1 = toPixelX(binStart);
		const x2 = toPixelX(binEnd);
		const avgValue = data.sum / data.count;
		const y = valueToY(avgValue);

		if (!started) {
			c.moveTo(x1, y);
			started = true;
		} else {
			c.lineTo(x1, y);
		}
		c.lineTo(x2, y);
	}
	c.stroke();

	// Draw Y-axis labels
	c.fillStyle = '#666666';
	c.font = '9px Inter, sans-serif';
	c.textAlign = 'left';
	c.fillText(maxVal.toFixed(1), 4, plotY + 8);
	c.fillText(minVal.toFixed(1), 4, plotY + plotHeight - 2);
}

export const signalTrackType: TrackTypeConfig<SignalFeature> = {
	id: 'signal',
	name: 'Signal (bedGraph)',
	extensions: ['bedgraph', 'bg'],
	style: 'signal',
	defaultHeight: 80,
	zoomBehavior: 'aggregate',
	parse: parseBedGraph,
	render: renderSignal,
};

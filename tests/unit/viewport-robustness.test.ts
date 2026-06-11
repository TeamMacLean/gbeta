import { describe, it, expect, beforeEach } from 'vitest';
import { useViewport } from '$lib/stores/viewport.svelte';

const vp = useViewport();

beforeEach(() => {
	vp.clearAllHighlights();
	vp.navigateTo('chr1', 1000, 2000);
});

describe('viewport — NaN/Infinity guards', () => {
	it('zoom(NaN) leaves the viewport finite and unchanged', () => {
		vp.zoom(NaN);
		expect(Number.isFinite(vp.current.start)).toBe(true);
		expect(Number.isFinite(vp.current.end)).toBe(true);
		expect(vp.current.start).toBe(1000);
		expect(vp.current.end).toBe(2000);
	});

	it('zoom(0) and zoom(-1) are ignored', () => {
		vp.zoom(0);
		vp.zoom(-1);
		expect(vp.current.end - vp.current.start).toBe(1000);
	});

	it('pan with pixelsPerBase 0 or NaN does not corrupt the viewport', () => {
		vp.pan(100, 0);
		expect(vp.current.start).toBe(1000);
		vp.pan(100, NaN);
		expect(Number.isFinite(vp.current.start)).toBe(true);
		expect(vp.current.start).toBe(1000);
	});

	it('a valid pan still works', () => {
		vp.pan(100, 1); // 100 bases left
		expect(vp.current.start).toBe(900);
		expect(vp.current.end).toBe(1900);
	});
});

describe('addHighlight — range normalization', () => {
	it('swaps an inverted range and clamps to >= 0', () => {
		vp.navigateTo('chr1', 0, 1000);
		vp.addHighlight('chr1', 500, 100); // inverted
		const h = vp.highlights[vp.highlights.length - 1];
		expect(h.start).toBe(100);
		expect(h.end).toBe(500);
	});

	it('ensures non-zero width and clamps negatives', () => {
		vp.addHighlight('chr1', -50, -50);
		const h = vp.highlights[vp.highlights.length - 1];
		expect(h.start).toBeGreaterThanOrEqual(0);
		expect(h.end).toBeGreaterThan(h.start);
	});
});

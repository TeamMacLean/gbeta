import { describe, it, expect } from 'vitest';
import { isCoverageSparse } from '$lib/stores/coverageWarning.svelte';

describe('isCoverageSparse', () => {
	it('returns false for empty input (handled as a load result, not sparse)', () => {
		expect(isCoverageSparse([])).toBe(false);
	});

	it('returns true when all windows are zero (nothing to draw)', () => {
		expect(isCoverageSparse([0, 0, 0, 0, 0])).toBe(true);
	});

	it('returns false when any window has coverage, even tiny fractional means', () => {
		// Per-bin means auto-scale to a visible peak, so this is NOT blank.
		expect(isCoverageSparse([0, 0, 0.02, 0, 0])).toBe(false);
	});

	it('returns false for a single low non-zero window', () => {
		// One stray read still draws a (scaled) peak — not a failed-load situation.
		const coverage = new Array(125).fill(0);
		coverage[60] = 0.1;
		expect(isCoverageSparse(coverage)).toBe(false);
	});

	it('returns false for genuine coverage', () => {
		const coverage = new Array(100).fill(0);
		for (let i = 0; i < 40; i++) coverage[i] = 5 + i;
		expect(isCoverageSparse(coverage)).toBe(false);
	});
});

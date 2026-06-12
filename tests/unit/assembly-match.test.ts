import { describe, it, expect } from 'vitest';
import { chromosomeMismatch, type ChromInfo } from '$lib/services/assemblyMatch';

// Minimal assembly chromosome maps.
const human: Record<string, number> = {
	chr7: 159345973,
	chr10: 133797422,
	chr12: 133275309,
	chr17: 83257441
};
const maize: Record<string, number> = {
	chr1: 308452471, chr2: 243675191, chr3: 238017767, chr4: 250330460, chr5: 226353449,
	chr6: 181357234, chr7: 185808916, chr8: 182411202, chr9: 163004744, chr10: 152435371
};
const ecoli: Record<string, number> = { 'NC_000913.3': 4641652 };

const lookup = (map: Record<string, number>) => (name: string): ChromInfo | undefined =>
	map[name] !== undefined ? { length: map[name] } : undefined;

// The bundled human example data sits on chr7/chr10/chr12/chr17.
const humanExample = [
	{ chromosome: 'chr17', end: 7687490 },
	{ chromosome: 'chr7', end: 55211628 },
	{ chromosome: 'chr12', end: 25250936 },
	{ chromosome: 'chr10', end: 87971930 }
];

describe('chromosomeMismatch', () => {
	it('does not flag human data on the human assembly', () => {
		expect(chromosomeMismatch(humanExample, lookup(human)).bad).toBe(false);
	});

	it('flags human data on maize even though chr7/chr10 names coincide', () => {
		// the reported bug: chr12 and chr17 are absent from maize (chr1-10)
		const r = chromosomeMismatch(humanExample, lookup(maize));
		expect(r.bad).toBe(true);
		expect(r.sample).toMatch(/chr12|chr17/);
	});

	it('flags human data on E. coli (no chromosome names match)', () => {
		expect(chromosomeMismatch(humanExample, lookup(ecoli)).bad).toBe(true);
	});

	it('does not false-positive on a different human build (same chr names, in-bounds)', () => {
		// GRCh37-ish: same names, slightly different lengths, coords still in range
		const grch37 = { chr7: 159138663, chr10: 135534747, chr12: 133851895, chr17: 81195210 };
		expect(chromosomeMismatch(humanExample, lookup(grch37)).bad).toBe(false);
	});

	it('does not flag a track with just a few stray contigs (low unmatched fraction)', () => {
		const feats = [
			{ chromosome: 'chr1', end: 1000 },
			{ chromosome: 'chr2', end: 1000 },
			{ chromosome: 'chr3', end: 1000 },
			{ chromosome: 'chrUn_scaffold', end: 1000 } // 1 of 4 = 25% < 34%
		];
		const asm = { chr1: 1e9, chr2: 1e9, chr3: 1e9 };
		expect(chromosomeMismatch(feats, lookup(asm)).bad).toBe(false);
	});

	it('flags when features run past the chromosome length (right name, wrong genome)', () => {
		const feats = [{ chromosome: 'chr1', end: 500_000_000 }]; // beyond
		const small = { chr1: 1_000_000 };
		const r = chromosomeMismatch(feats, lookup(small));
		expect(r.bad).toBe(true);
		expect(r.sample).toMatch(/beyond chromosome length/);
	});

	it('handles empty feature lists', () => {
		expect(chromosomeMismatch([], lookup(human)).bad).toBe(false);
	});
});

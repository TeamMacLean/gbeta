/**
 * bedGraph Parser Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { signalTrackType } from '$lib/services/trackTypes/signal';

const parse = signalTrackType.parse;

describe('bedGraph Parser', () => {
	describe('basic parsing', () => {
		it('parses a simple bedGraph line', () => {
			const bg = 'chr1\t100\t200\t1.5';
			const result = parse(bg);
			expect(result.errors).toHaveLength(0);
			expect(result.features).toHaveLength(1);
			expect(result.features[0]).toMatchObject({
				chromosome: 'chr1',
				start: 100,
				end: 200,
				value: 1.5,
			});
		});

		it('parses multiple features', () => {
			const bg = `chr1\t100\t200\t1.0
chr1\t200\t300\t2.0
chr1\t300\t400\t3.0`;
			const result = parse(bg);
			expect(result.features).toHaveLength(3);
		});

		it('assigns unique IDs to features', () => {
			const bg = 'chr1\t100\t200\t1.0\nchr1\t200\t300\t2.0';
			const result = parse(bg);
			const ids = result.features.map(f => f.id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	describe('value handling', () => {
		it('parses integer values', () => {
			const result = parse('chr1\t100\t200\t42');
			expect(result.features[0].value).toBe(42);
		});

		it('parses floating point values', () => {
			const result = parse('chr1\t100\t200\t3.14159');
			expect(result.features[0].value).toBeCloseTo(3.14159);
		});

		it('parses negative values', () => {
			const result = parse('chr1\t100\t200\t-1.5');
			expect(result.features[0].value).toBe(-1.5);
		});

		it('parses zero values', () => {
			const result = parse('chr1\t100\t200\t0');
			expect(result.features[0].value).toBe(0);
		});

		it('parses scientific notation', () => {
			const result = parse('chr1\t100\t200\t1.5e-3');
			expect(result.features[0].value).toBeCloseTo(0.0015);
		});
	});

	describe('metadata', () => {
		it('calculates min and max values', () => {
			const bg = `chr1\t100\t200\t1.0
chr1\t200\t300\t5.0
chr1\t300\t400\t3.0`;
			const result = parse(bg);
			expect(result.metadata?.minValue).toBe(1.0);
			expect(result.metadata?.maxValue).toBe(5.0);
		});

		it('handles negative min values', () => {
			const bg = `chr1\t100\t200\t-2.0
chr1\t200\t300\t3.0`;
			const result = parse(bg);
			expect(result.metadata?.minValue).toBe(-2.0);
			expect(result.metadata?.maxValue).toBe(3.0);
		});

		it('returns default metadata for empty file', () => {
			const result = parse('');
			expect(result.metadata?.minValue).toBe(0);
			expect(result.metadata?.maxValue).toBe(1);
		});
	});

	describe('whitespace handling', () => {
		it('parses tab-separated fields', () => {
			const result = parse('chr1\t100\t200\t1.5');
			expect(result.features).toHaveLength(1);
		});

		it('parses space-separated fields', () => {
			const result = parse('chr1 100 200 1.5');
			expect(result.features).toHaveLength(1);
		});

		it('parses mixed whitespace', () => {
			const result = parse('chr1\t100  200\t1.5');
			expect(result.features).toHaveLength(1);
		});
	});

	describe('header handling', () => {
		it('skips comment lines', () => {
			const bg = `# This is a comment
chr1\t100\t200\t1.5`;
			const result = parse(bg);
			expect(result.features).toHaveLength(1);
		});

		it('skips track lines', () => {
			const bg = `track type=bedGraph name="My Track"
chr1\t100\t200\t1.5`;
			const result = parse(bg);
			expect(result.features).toHaveLength(1);
		});

		it('skips browser lines', () => {
			const bg = `browser position chr1:1-1000
chr1\t100\t200\t1.5`;
			const result = parse(bg);
			expect(result.features).toHaveLength(1);
		});

		it('skips empty lines', () => {
			const bg = `
chr1\t100\t200\t1.5

chr1\t200\t300\t2.0
`;
			const result = parse(bg);
			expect(result.features).toHaveLength(2);
		});
	});

	describe('error handling', () => {
		it('reports error for fewer than 4 fields', () => {
			const result = parse('chr1\t100\t200');
			expect(result.features).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Expected at least 4 fields');
		});

		it('reports error for invalid start coordinate', () => {
			const result = parse('chr1\tabc\t200\t1.0');
			expect(result.features).toHaveLength(0);
			expect(result.errors[0]).toMatch(/integer|invalid/i);
		});

		it('reports error for invalid end coordinate', () => {
			const result = parse('chr1\t100\txyz\t1.0');
			expect(result.features).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
		});

		it('reports error for invalid value', () => {
			const result = parse('chr1\t100\t200\tnot_a_number');
			expect(result.features).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
		});

		it('reports error for negative start', () => {
			const result = parse('chr1\t-10\t200\t1.0');
			expect(result.features).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
		});

		it('reports error for end <= start', () => {
			const result = parse('chr1\t200\t100\t1.0');
			expect(result.features).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
		});

		it('continues parsing after errors', () => {
			const bg = `chr1\tinvalid
chr1\t100\t200\t1.5`;
			const result = parse(bg);
			expect(result.features).toHaveLength(1);
			expect(result.errors).toHaveLength(1);
		});

		it('includes line number in error', () => {
			const bg = `chr1\t100\t200\t1.0
chr1\tinvalid`;
			const result = parse(bg);
			expect(result.errors[0]).toContain('Line 2');
		});
	});

	describe('chromosome names', () => {
		it('handles chr-prefixed names', () => {
			const result = parse('chr1\t100\t200\t1.0');
			expect(result.features[0].chromosome).toBe('chr1');
		});

		it('handles non-prefixed names', () => {
			const result = parse('scaffold_1\t100\t200\t1.0');
			expect(result.features[0].chromosome).toBe('scaffold_1');
		});

		it('preserves chromosome name as-is', () => {
			// Unlike VCF, bedGraph doesn't add chr prefix
			const result = parse('1\t100\t200\t1.0');
			expect(result.features[0].chromosome).toBe('1');
		});
	});

	describe('real-world data', () => {
		it('parses sample bedGraph file', async () => {
			const fs = await import('fs');
			const content = fs.readFileSync('tests/fixtures/sample-signal.bedgraph', 'utf-8');
			const result = parse(content);

			expect(result.features.length).toBeGreaterThan(0);
			expect(result.metadata?.minValue).toBeDefined();
			expect(result.metadata?.maxValue).toBeDefined();

			for (const feature of result.features) {
				expect(feature.start).toBeGreaterThanOrEqual(0);
				expect(feature.end).toBeGreaterThan(feature.start);
				expect(typeof feature.value).toBe('number');
			}
		});
	});
});

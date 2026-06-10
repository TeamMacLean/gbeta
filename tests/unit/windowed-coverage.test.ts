/**
 * Windowed BAM Coverage - TDD Implementation Tests
 *
 * Phase 1: Core windowed coverage functionality
 * Following red-green-refactor TDD approach
 */
import { describe, test, expect } from 'vitest';

// Import functions that don't exist yet (TDD red phase)
import {
	calculateOptimalBinSize,
	generateSamplePositions,
	queryPositionalDepth,
	createWindowedCoverage,
	computeBinMeanCoverage,
	type WindowedCoverageData
} from '$lib/services/windowedCoverage';

describe('Phase 1.1: Bin Size Calculation', () => {
	describe('calculateOptimalBinSize', () => {
		test('should return 10KB bins for 1MB region on 1000px canvas', () => {
			const regionSize = 1000000; // 1MB
			const canvasWidth = 1000;   // 1000px

			const binSize = calculateOptimalBinSize(regionSize, canvasWidth);

			// 1MB / 1000px = 1KB per pixel, but we want ~100 bins for efficiency
			// So 1MB / 100 bins = 10KB per bin
			expect(binSize).toBe(10000);
		});

		test('should return 1KB bins for 100KB region on 1000px canvas', () => {
			const regionSize = 100000; // 100KB
			const canvasWidth = 1000;   // 1000px

			const binSize = calculateOptimalBinSize(regionSize, canvasWidth);

			// 100KB / 1000px = 100bp per pixel
			// For good resolution, use 1KB bins (100KB / 100 bins)
			expect(binSize).toBe(1000);
		});

		test('should respect user resolution overrides', () => {
			const regionSize = 1000000; // 1MB
			const canvasWidth = 1000;

			// User chooses "high resolution" = smaller bins
			const highRes = calculateOptimalBinSize(regionSize, canvasWidth, 'high');
			expect(highRes).toBe(1000); // 1KB bins for high resolution

			// User chooses "fast" = larger bins
			const fastRes = calculateOptimalBinSize(regionSize, canvasWidth, 'fast');
			expect(fastRes).toBe(20000); // 20KB bins for fast mode

			// User chooses "medium" = default calculated size
			const mediumRes = calculateOptimalBinSize(regionSize, canvasWidth, 'medium');
			expect(mediumRes).toBe(10000); // 10KB bins (default for 1MB)
		});

		test('should have minimum bin size limit', () => {
			const smallRegion = 1000; // 1KB region
			const canvasWidth = 1000;

			const binSize = calculateOptimalBinSize(smallRegion, canvasWidth);

			// Should not go below 100bp minimum bin size
			expect(binSize).toBeGreaterThanOrEqual(100);
		});

		test('should have maximum bin size limit', () => {
			const hugeRegion = 100000000; // 100MB region
			const canvasWidth = 100;      // Small canvas

			const binSize = calculateOptimalBinSize(hugeRegion, canvasWidth);

			// Should not exceed 1MB maximum bin size
			expect(binSize).toBeLessThanOrEqual(1000000);
		});

		test('should handle edge cases gracefully', () => {
			// Zero/negative inputs
			expect(() => calculateOptimalBinSize(0, 1000)).toThrow();
			expect(() => calculateOptimalBinSize(1000, 0)).toThrow();
			expect(() => calculateOptimalBinSize(-1000, 1000)).toThrow();

			// Very small inputs
			const tiny = calculateOptimalBinSize(50, 10);
			expect(tiny).toBeGreaterThan(0);
			expect(Number.isInteger(tiny)).toBe(true);
		});
	});

	describe('Phase 1.2: Position Generation', () => {
		describe('generateSamplePositions', () => {
			test('should generate correct number of positions for region/bin size', () => {
				const start = 5000000;
				const end = 6000000; // 1MB region
				const binSize = 10000;   // 10KB bins

				const positions = generateSamplePositions(start, end, binSize);

				// 1MB / 10KB = 100 bins = 100 positions
				expect(positions).toHaveLength(100);
			});

			test('should sample at bin midpoints for optimal representation', () => {
				const start = 1000000;
				const end = 1030000; // 30KB region
				const binSize = 10000;   // 10KB bins

				const positions = generateSamplePositions(start, end, binSize);

				// Should have 3 bins: 1000000-1010000, 1010000-1020000, 1020000-1030000
				// Midpoints: 1005000, 1015000, 1025000
				expect(positions).toEqual([1005000, 1015000, 1025000]);
			});

			test('should handle edge cases (region smaller than bin size)', () => {
				const start = 1000000;
				const end = 1005000; // 5KB region
				const binSize = 10000;   // 10KB bin (larger than region)

				const positions = generateSamplePositions(start, end, binSize);

				// Should still generate one position at region midpoint
				expect(positions).toHaveLength(1);
				expect(positions[0]).toBe(1002500); // Midpoint of 1000000-1005000
			});

			test('should maintain integer positions', () => {
				const start = 1000001;
				const end = 1000501; // 500bp region
				const binSize = 100;    // 100bp bins

				const positions = generateSamplePositions(start, end, binSize);

				// All positions should be integers
				positions.forEach(pos => {
					expect(Number.isInteger(pos)).toBe(true);
				});
			});

			test('should not exceed region boundaries', () => {
				const start = 2000000;
				const end = 2100000; // 100KB region
				const binSize = 15000;   // 15KB bins

				const positions = generateSamplePositions(start, end, binSize);

				// All positions should be within bounds
				positions.forEach(pos => {
					expect(pos).toBeGreaterThanOrEqual(start);
					expect(pos).toBeLessThanOrEqual(end);
				});
			});

			test('should handle invalid inputs gracefully', () => {
				// Start >= end
				expect(() => generateSamplePositions(1000000, 1000000, 1000)).toThrow();
				expect(() => generateSamplePositions(1000000, 999999, 1000)).toThrow();

				// Zero/negative bin size
				expect(() => generateSamplePositions(1000000, 2000000, 0)).toThrow();
				expect(() => generateSamplePositions(1000000, 2000000, -1000)).toThrow();
			});
		});
	});

	describe('Phase 1.3: BAM Position Querying', () => {
		describe('queryPositionalDepth', () => {
			test('should query depth at specific positions efficiently', async () => {
				// Use a mock BAM URL for testing
				const bamUrl = 'test://mock.bam';
				const chr = 'chr1';
				const positions = [1000000, 1010000, 1020000];

				// This should return depth values for each position
				const depths = await queryPositionalDepth(bamUrl, chr, positions);

				expect(depths).toHaveLength(3);
				// Depths should be numbers >= 0
				depths.forEach(depth => {
					expect(typeof depth).toBe('number');
					expect(depth).toBeGreaterThanOrEqual(0);
				});
			});

			test('should handle positions with no coverage (return 0)', async () => {
				const bamUrl = 'test://mock.bam';
				const chr = 'chr1';
				const positions = [999999999]; // Very high position with no coverage

				const depths = await queryPositionalDepth(bamUrl, chr, positions);

				expect(depths).toEqual([0]); // Should return 0 for no coverage
			});

			test('should batch multiple position queries for performance', async () => {
				const bamUrl = 'test://mock.bam';
				const chr = 'chr1';
				const positions = Array.from({ length: 100 }, (_, i) => 1000000 + i * 1000);

				const startTime = Date.now();
				const depths = await queryPositionalDepth(bamUrl, chr, positions);
				const duration = Date.now() - startTime;

				expect(depths).toHaveLength(100);
				// Should be reasonably fast for 100 positions
				expect(duration).toBeLessThan(1000); // Less than 1 second
			});

			test('should maintain position-to-depth mapping correctly', async () => {
				const bamUrl = 'test://mock.bam';
				const chr = 'chr1';
				const positions = [1001000, 1000000, 1002000]; // Out of order

				const depths = await queryPositionalDepth(bamUrl, chr, positions);

				// Should return depths in same order as positions
				expect(depths).toHaveLength(3);
				// Position index should match depth index
				expect(depths[0]).toBeGreaterThanOrEqual(0); // Depth for 1001000
				expect(depths[1]).toBeGreaterThanOrEqual(0); // Depth for 1000000
				expect(depths[2]).toBeGreaterThanOrEqual(0); // Depth for 1002000
			});

			test('should handle BAM querying errors gracefully', async () => {
				const bamUrl = 'invalid://nonexistent.bam';
				const chr = 'chr1';
				const positions = [1000000];

				// Should not throw error, but handle gracefully
				await expect(queryPositionalDepth(bamUrl, chr, positions)).rejects.toThrow();
			});

			test('should handle empty position array', async () => {
				const bamUrl = 'test://mock.bam';
				const chr = 'chr1';
				const positions: number[] = [];

				const depths = await queryPositionalDepth(bamUrl, chr, positions);

				expect(depths).toEqual([]);
			});
		});
	});

	describe('Phase 1.4: Coverage Assembly', () => {
		describe('createWindowedCoverage', () => {
			test('should create coverage data compatible with existing rendering', () => {
				const positions = [1000000, 1010000, 1020000];
				const depths = [5, 15, 8];

				const coverage = createWindowedCoverage(positions, depths);

				// Should return array of coverage data objects
				expect(coverage).toHaveLength(3);

				// Each object should have start, end, value properties
				coverage.forEach(cov => {
					expect(cov).toHaveProperty('start');
					expect(cov).toHaveProperty('end');
					expect(cov).toHaveProperty('value');
					expect(typeof cov.start).toBe('number');
					expect(typeof cov.end).toBe('number');
					expect(typeof cov.value).toBe('number');
				});
			});

			test('should map positions to coverage values correctly', () => {
				const positions = [1000000, 1005000, 1010000];
				const depths = [10, 0, 25];

				const coverage = createWindowedCoverage(positions, depths);

				// Should map each position-depth pair correctly
				expect(coverage[0].value).toBe(10);
				expect(coverage[1].value).toBe(0);
				expect(coverage[2].value).toBe(25);

				// Positions should be used as midpoints for coverage intervals
				expect(coverage[0].start).toBeLessThan(1000000);
				expect(coverage[0].end).toBeGreaterThan(1000000);
				expect(coverage[1].start).toBeLessThan(1005000);
				expect(coverage[1].end).toBeGreaterThan(1005000);
			});

			test('should handle missing/zero depth values', () => {
				const positions = [1000000, 1010000, 1020000];
				const depths = [0, 10, 0];

				const coverage = createWindowedCoverage(positions, depths);

				// Should handle zero depths gracefully
				expect(coverage).toHaveLength(3);
				expect(coverage[0].value).toBe(0);
				expect(coverage[1].value).toBe(10);
				expect(coverage[2].value).toBe(0);

				// All coverage data should have valid start/end coordinates
				coverage.forEach(cov => {
					expect(cov.start).toBeGreaterThanOrEqual(0);
					expect(cov.end).toBeGreaterThan(cov.start);
				});
			});

			test('should maintain data format for TrackView.svelte consumption', () => {
				const positions = [2000000, 2100000];
				const depths = [12, 8];

				const coverage = createWindowedCoverage(positions, depths);

				// Should create contiguous coverage intervals
				expect(coverage).toHaveLength(2);

				// Coverage intervals should not overlap
				expect(coverage[0].end).toBeLessThanOrEqual(coverage[1].start);

				// Should use WindowedCoverageData interface format
				const expectedFormat: WindowedCoverageData = {
					start: expect.any(Number),
					end: expect.any(Number),
					value: expect.any(Number)
				};

				coverage.forEach(cov => {
					expect(cov).toMatchObject(expectedFormat);
				});
			});

			test('should handle edge cases gracefully', () => {
				// Empty arrays
				expect(createWindowedCoverage([], [])).toEqual([]);

				// Single position
				const singleCoverage = createWindowedCoverage([1500000], [20]);
				expect(singleCoverage).toHaveLength(1);
				expect(singleCoverage[0].value).toBe(20);

				// Mismatched array lengths should throw
				expect(() => createWindowedCoverage([1000000, 2000000], [10])).toThrow();
				expect(() => createWindowedCoverage([1000000], [10, 20])).toThrow();
			});
		});
	});

	describe('Phase 1.5: Per-Bin Mean Coverage', () => {
		describe('computeBinMeanCoverage', () => {
			test('should tile [start,end) into uniform contiguous bins', async () => {
				const bamUrl = 'test://mock.bam';
				const coverage = await computeBinMeanCoverage(bamUrl, 'chr1', 1000000, 1030000, 10000);

				// 30KB / 10KB = 3 bins
				expect(coverage).toHaveLength(3);

				// Bins must uniformly tile the region with no gaps/overlaps
				expect(coverage[0].start).toBe(1000000);
				expect(coverage[0].end).toBe(1010000);
				expect(coverage[1].start).toBe(1010000);
				expect(coverage[1].end).toBe(1020000);
				expect(coverage[2].start).toBe(1020000);
				expect(coverage[2].end).toBe(1030000);
			});

			test('should cover the entire region even when not divisible by bin size', async () => {
				const bamUrl = 'test://mock.bam';
				const coverage = await computeBinMeanCoverage(bamUrl, 'chr1', 0, 25000, 10000);

				// 3 bins: [0,10000), [10000,20000), [20000,25000)
				expect(coverage).toHaveLength(3);
				expect(coverage[0].start).toBe(0);
				expect(coverage[coverage.length - 1].end).toBe(25000); // last bin reaches region end
			});

			test('should return mean depth values >= 0 for each bin', async () => {
				const bamUrl = 'test://mock.bam';
				const coverage = await computeBinMeanCoverage(bamUrl, 'chr1', 100000, 300000, 10000);

				expect(coverage.length).toBeGreaterThan(0);
				coverage.forEach((bin) => {
					expect(typeof bin.value).toBe('number');
					expect(bin.value).toBeGreaterThanOrEqual(0);
					expect(bin.end).toBeGreaterThan(bin.start);
				});
			});

			test('should compute mean as overlap-weighted average across the bin', async () => {
				// test:// mock produces deterministic full-bin coverage of reads tiled
				// across the region, so the mean should be > 0 for covered bins.
				const bamUrl = 'test://mock.bam';
				const coverage = await computeBinMeanCoverage(bamUrl, 'chr1', 0, 20000, 10000);

				expect(coverage).toHaveLength(2);
				// Mock reads tile the whole region, so every bin should report coverage
				coverage.forEach((bin) => {
					expect(bin.value).toBeGreaterThan(0);
				});
			});

			test('should propagate hard BAM access errors', async () => {
				const bamUrl = 'invalid://nonexistent.bam';
				await expect(
					computeBinMeanCoverage(bamUrl, 'chr1', 0, 20000, 10000)
				).rejects.toThrow();
			});

			test('should throw on invalid inputs', async () => {
				await expect(
					computeBinMeanCoverage('test://mock.bam', 'chr1', 1000, 1000, 100)
				).rejects.toThrow();
				await expect(
					computeBinMeanCoverage('test://mock.bam', 'chr1', 0, 1000, 0)
				).rejects.toThrow();
			});
		});
	});
});
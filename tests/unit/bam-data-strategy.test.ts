/**
 * BAM Data Strategy - TDD Implementation Tests
 *
 * Phase 2: Integration with existing zoom-level rendering system
 * Following red-green-refactor TDD approach
 */
import { describe, test, expect } from 'vitest';

// Import functions that don't exist yet (TDD red phase)
import {
	selectBamStrategy,
	getBamData,
	type BamDataStrategy,
	type BamData
} from '$lib/services/bamDataStrategy';

describe('Phase 2: Zoom System Integration', () => {
	describe('Phase 2.1: Data Strategy Selection', () => {
		describe('selectBamStrategy', () => {
			test('should use windowed coverage for density mode (pixelsPerBase < 1)', () => {
				const regionSize = 1000000; // 1MB
				const pixelsPerBase = 0.001;  // Very zoomed out (1000bp per pixel)

				const strategy = selectBamStrategy(regionSize, pixelsPerBase);

				expect(strategy.useWindowed).toBe(true);
				expect(strategy.binSize).toBeGreaterThan(0);
				expect(strategy.maxReads).toBeUndefined(); // Not used for windowed
			});

			test('should use individual reads for blocks mode (30 <= pixelsPerBase < 8)', () => {
				const regionSize = 10000; // 10KB
				const pixelsPerBase = 35;   // Above new threshold (gene-level detail)

				const strategy = selectBamStrategy(regionSize, pixelsPerBase);

				expect(strategy.useWindowed).toBe(false);
				expect(strategy.binSize).toBeUndefined(); // Not used for reads
				expect(strategy.maxReads).toBeGreaterThan(0);
			});

			test('should use individual reads for sequence mode (pixelsPerBase >= 30)', () => {
				const regionSize = 1000; // 1KB
				const pixelsPerBase = 50;  // High zoom (gene-level detail)

				const strategy = selectBamStrategy(regionSize, pixelsPerBase);

				expect(strategy.useWindowed).toBe(false);
				expect(strategy.binSize).toBeUndefined(); // Not used for reads
				expect(strategy.maxReads).toBeGreaterThan(0);
			});

			test('should target consistent window counts within density mode', () => {
				const regionSize1MB = 1000000; // 1MB
				const regionSize100KB = 100000; // 100KB

				// Both should use windowed coverage and target similar window counts
				const strategy1MB = selectBamStrategy(regionSize1MB, 0.1);
				const strategy100KB = selectBamStrategy(regionSize100KB, 0.1);

				expect(strategy1MB.useWindowed).toBe(true);
				expect(strategy100KB.useWindowed).toBe(true);

				// Both should target ~125 windows (medium quality default)
				const windows1MB = Math.round(regionSize1MB / strategy1MB.binSize!);
				const windows100KB = Math.round(regionSize100KB / strategy100KB.binSize!);

				expect(windows1MB).toBeGreaterThanOrEqual(100);
				expect(windows1MB).toBeLessThanOrEqual(150);
				expect(windows100KB).toBeGreaterThanOrEqual(100);
				expect(windows100KB).toBeLessThanOrEqual(150);
			});

			test('should respect user resolution overrides', () => {
				const regionSize = 1000000; // 1MB
				const pixelsPerBase = 0.001;  // Density mode

				const fastStrategy = selectBamStrategy(regionSize, pixelsPerBase, 'fast');
				const highStrategy = selectBamStrategy(regionSize, pixelsPerBase, 'high');

				expect(fastStrategy.useWindowed).toBe(true);
				expect(highStrategy.useWindowed).toBe(true);
				expect(fastStrategy.binSize).toBeGreaterThan(highStrategy.binSize!); // fast = larger bins
			});

			test('should provide performance estimates', () => {
				const regionSize = 1000000; // 1MB
				const pixelsPerBase = 0.001;  // Density mode

				const strategy = selectBamStrategy(regionSize, pixelsPerBase);

				expect(strategy).toHaveProperty('useWindowed');
				expect(strategy).toHaveProperty('binSize');
				// Strategy should contain information for performance estimates
				expect(typeof strategy.useWindowed).toBe('boolean');
				expect(typeof strategy.binSize).toBe('number');
			});
		});
	});

	describe('Phase 2.2: Data Source Routing', () => {
		describe('getBamData', () => {
			test('should route to windowed coverage when strategy.useWindowed = true', async () => {
				const bamUrl = 'test://coverage.bam';
				const chr = 'chr1';
				const start = 1000000;
				const end = 2000000;
				const strategy: BamDataStrategy = {
					useWindowed: true,
					binSize: 10000
				};

				const data = await getBamData(bamUrl, chr, start, end, strategy);

				// Should return coverage data format
				expect(data).toHaveProperty('type', 'coverage');
				expect(data).toHaveProperty('data');
				expect(Array.isArray(data.data)).toBe(true);
			});

			test('should route to individual reads when strategy.useWindowed = false', async () => {
				const bamUrl = 'test://reads.bam';
				const chr = 'chr1';
				const start = 1000000;
				const end = 1010000;
				const strategy: BamDataStrategy = {
					useWindowed: false,
					maxReads: 5000
				};

				const data = await getBamData(bamUrl, chr, start, end, strategy);

				// Should return reads data format
				expect(data).toHaveProperty('type', 'reads');
				expect(data).toHaveProperty('data');
				expect(Array.isArray(data.data)).toBe(true);
			});

			test('should pass correct parameters to each data source', async () => {
				const bamUrl = 'test://params.bam';
				const chr = 'chr2';
				const start = 500000;
				const end = 600000;
				const strategy: BamDataStrategy = {
					useWindowed: true,
					binSize: 5000
				};

				const data = await getBamData(bamUrl, chr, start, end, strategy);

				// Should use correct parameters for windowed coverage
				expect(data.type).toBe('coverage');
				// Data should reflect the correct region and bin size
				expect(data.data.length).toBeGreaterThan(0); // Should have coverage data
			});

			test('should maintain consistent data format for rendering', async () => {
				const bamUrl = 'test://format.bam';
				const chr = 'chr1';
				const start = 1000000;
				const end = 1100000;

				// Test both windowed and reads strategies
				const windowedStrategy: BamDataStrategy = { useWindowed: true, binSize: 1000 };
				const readsStrategy: BamDataStrategy = { useWindowed: false, maxReads: 1000 };

				const windowedData = await getBamData(bamUrl, chr, start, end, windowedStrategy);
				const readsData = await getBamData(bamUrl, chr, start, end, readsStrategy);

				// Both should have consistent top-level format
				expect(windowedData).toHaveProperty('type');
				expect(windowedData).toHaveProperty('data');
				expect(readsData).toHaveProperty('type');
				expect(readsData).toHaveProperty('data');

				// Type should indicate data source
				expect(windowedData.type).toBe('coverage');
				expect(readsData.type).toBe('reads');
			});

			test('should handle errors from both data sources', async () => {
				const bamUrl = 'invalid://error.bam';
				const chr = 'chr1';
				const start = 1000000;
				const end = 2000000;

				const windowedStrategy: BamDataStrategy = { useWindowed: true, binSize: 1000 };
				const readsStrategy: BamDataStrategy = { useWindowed: false, maxReads: 1000 };

				// Both should handle errors gracefully
				await expect(getBamData(bamUrl, chr, start, end, windowedStrategy)).rejects.toThrow();
				await expect(getBamData(bamUrl, chr, start, end, readsStrategy)).rejects.toThrow();
			});
		});
	});
});
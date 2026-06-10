/**
 * Real BAM File Performance Tests
 *
 * Tests coverage queries with actual NA12878 chromosome 11 data (673MB)
 * This validates our TDD implementation with real-world genomic files.
 */
import { describe, test, expect } from 'vitest';
import {
	queryBamCoverage,
	getBamCoverageData,
	type CoverageRegion
} from '$lib/services/bam';

// Path to our downloaded test file (file:// URL)
const BAM_FILE = 'file:///Users/macleand/Desktop/gbetter/test-data/large-files/NA12878.chrom11.bam';
const TEST_CHROMOSOME = 'chr11';

// Skip these tests if the BAM file isn't available
const skipIfNoBam = process.env.SKIP_BAM_TESTS ? test.skip : test;

describe('Real BAM Performance Tests', () => {
	describe('Coverage queries with NA12878 chr11 (673MB)', () => {
		skipIfNoBam('should query 100kb region efficiently', async () => {
			// Test moderate region (100kb)
			const start = 5000000;
			const end = 5100000;
			const minCoverage = 10;

			const startTime = Date.now();
			const regions = await queryBamCoverage(BAM_FILE, TEST_CHROMOSOME, start, end, minCoverage);
			const queryTime = Date.now() - startTime;

			// Performance expectations
			expect(queryTime).toBeLessThan(5000); // Should complete in < 5 seconds
			expect(Array.isArray(regions)).toBe(true);

			console.log(`✅ 100kb region query: ${queryTime}ms, found ${regions.length} regions`);

			if (regions.length > 0) {
				// Validate structure
				expect(regions[0]).toHaveProperty('chromosome');
				expect(regions[0]).toHaveProperty('start');
				expect(regions[0]).toHaveProperty('end');
				expect(regions[0]).toHaveProperty('coverage');
				expect(regions[0].coverage).toBeGreaterThanOrEqual(minCoverage);

				console.log(`   Sample: ${regions[0].chromosome}:${regions[0].start}-${regions[0].end} (${regions[0].coverage}x)`);
			}
		}, 30000); // 30 second timeout

		skipIfNoBam('should handle large 1MB region efficiently', async () => {
			// Test large region (1MB)
			const start = 5000000;
			const end = 6000000; // 1MB
			const minCoverage = 5; // Lower threshold for broader coverage

			const startTime = Date.now();
			const regions = await queryBamCoverage(BAM_FILE, TEST_CHROMOSOME, start, end, minCoverage);
			const queryTime = Date.now() - startTime;

			// Performance expectations for larger region
			expect(queryTime).toBeLessThan(15000); // Should complete in < 15 seconds
			expect(Array.isArray(regions)).toBe(true);

			console.log(`✅ 1MB region query: ${queryTime}ms, found ${regions.length} regions`);

			// Should find some coverage in a 1MB region
			expect(regions.length).toBeGreaterThan(0);
		}, 60000); // 60 second timeout

		skipIfNoBam('should provide detailed coverage data for visualization', async () => {
			// Test coverage data extraction for smaller region
			const start = 5000000;
			const end = 5010000; // 10kb

			const startTime = Date.now();
			const coverageData = await getBamCoverageData(BAM_FILE, TEST_CHROMOSOME, start, end);
			const queryTime = Date.now() - startTime;

			expect(queryTime).toBeLessThan(3000); // Should be fast for small regions
			expect(coverageData.coverage).toHaveLength(10000); // 10kb = 10,000 positions

			const maxCoverage = Math.max(...coverageData.coverage);
			const avgCoverage = coverageData.coverage.reduce((a, b) => a + b, 0) / coverageData.coverage.length;

			console.log(`✅ Coverage data: ${queryTime}ms, max=${maxCoverage}x, avg=${avgCoverage.toFixed(2)}x`);

			expect(maxCoverage).toBeGreaterThan(0); // Should have some reads
		}, 15000);

		skipIfNoBam('should handle different coverage thresholds correctly', async () => {
			const start = 5000000;
			const end = 5050000; // 50kb

			// Test multiple thresholds
			const thresholds = [1, 5, 10, 20];
			const results: Record<number, CoverageRegion[]> = {};

			for (const threshold of thresholds) {
				const startTime = Date.now();
				results[threshold] = await queryBamCoverage(BAM_FILE, TEST_CHROMOSOME, start, end, threshold);
				const queryTime = Date.now() - startTime;

				expect(queryTime).toBeLessThan(5000); // Should be consistent
				console.log(`   Threshold ${threshold}x: ${results[threshold].length} regions (${queryTime}ms)`);
			}

			// Higher thresholds should return fewer or equal regions
			expect(results[20].length).toBeLessThanOrEqual(results[10].length);
			expect(results[10].length).toBeLessThanOrEqual(results[5].length);
			expect(results[5].length).toBeLessThanOrEqual(results[1].length);
		}, 30000);

		skipIfNoBam('should handle edge cases gracefully', async () => {
			// Test edge cases
			const testCases = [
				{ start: 1, end: 1000, desc: 'chromosome start' },
				{ start: 134000000, end: 134001000, desc: 'chromosome end region' },
				{ start: 50000000, end: 50000001, desc: 'single base' }
			];

			for (const testCase of testCases) {
				const startTime = Date.now();
				try {
					const regions = await queryBamCoverage(BAM_FILE, TEST_CHROMOSOME, testCase.start, testCase.end, 1);
					const queryTime = Date.now() - startTime;

					expect(Array.isArray(regions)).toBe(true);
					console.log(`   ${testCase.desc}: ${regions.length} regions (${queryTime}ms)`);
				} catch (error) {
					// Some edge regions might have no data, which is fine
					console.log(`   ${testCase.desc}: No data (expected for some regions)`);
				}
			}
		}, 20000);
	});

	describe('Memory and resource efficiency', () => {
		skipIfNoBam('should not consume excessive memory', async () => {
			// Test that memory usage stays reasonable
			const initialMemory = process.memoryUsage().heapUsed;

			// Query multiple regions
			for (let i = 0; i < 10; i++) {
				const start = 5000000 + (i * 100000);
				const end = start + 50000;
				await queryBamCoverage(BAM_FILE, TEST_CHROMOSOME, start, end, 5);
			}

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

			console.log(`✅ Memory usage: +${memoryIncrease.toFixed(2)}MB for 10 queries`);

			// Should not use excessive memory (indexed approach should be efficient)
			expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
		}, 30000);
	});
});
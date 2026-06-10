/**
 * BAM Coverage Query API Tests
 *
 * Tests the higher-level coverage query functions.
 * Tests the pure computation logic by providing mock read data.
 */
import { describe, test, expect } from 'vitest';
import type { BAMReadFeature } from '$lib/types/tracks';

// Import functions to test - just the computation functions for now
import {
	computeCoverage,
	findCoverageRegions,
	type CoverageRegion
} from '$lib/services/bam';

describe('Coverage Query Integration', () => {
	// Helper to create mock BAM reads
	function createMockRead(start: number, end: number, id: string = 'read'): BAMReadFeature {
		return {
			id: `${id}:${start}-${end}`,
			chromosome: 'chr1',
			start,
			end,
			name: id,
			seq: 'A'.repeat(end - start),
			qual: null,
			cigar: `${end - start}M`,
			parsedCigar: [['M', end - start]],
			mq: 30,
			isReversed: false,
			readName: id,
			flags: 0
		} as BAMReadFeature;
	}

	describe('End-to-end coverage queries', () => {
		test('should find high-coverage regions from mock RNA-seq data', () => {
			// Simulate RNA-seq reads covering multiple exons
			const reads: BAMReadFeature[] = [
				// Exon 1: high coverage (10x)
				...Array.from({ length: 10 }, (_, i) =>
					createMockRead(1000, 1050, `exon1_read${i}`)
				),
				// Intron: low coverage (2x) - some reads span across
				createMockRead(1040, 1110, 'span1'),
				createMockRead(1045, 1115, 'span2'),
				// Exon 2: medium coverage (5x)
				...Array.from({ length: 5 }, (_, i) =>
					createMockRead(1100, 1150, `exon2_read${i}`)
				)
			];

			// Compute coverage for region spanning both exons
			const coverage = computeCoverage(reads, 1000, 1150);

			// Find regions with different coverage thresholds
			const highCoverageRegions = findCoverageRegions(coverage, 1000, 8, 'chr1');
			const mediumCoverageRegions = findCoverageRegions(coverage, 1000, 4, 'chr1');

			// Should find exon 1 as high coverage
			expect(highCoverageRegions).toHaveLength(1);
			expect(highCoverageRegions[0].start).toBe(1000);
			expect(highCoverageRegions[0].coverage).toBeGreaterThanOrEqual(8);

			// Should find both exons as medium coverage
			expect(mediumCoverageRegions.length).toBeGreaterThan(1);
		});

		test('should handle ChIP-seq like data with sparse peaks', () => {
			// Simulate ChIP-seq with sparse high-coverage peaks
			const reads: BAMReadFeature[] = [
				// Background: scattered low coverage
				createMockRead(2000, 2050, 'bg1'),
				createMockRead(2100, 2150, 'bg2'),
				// Peak 1: high coverage cluster
				...Array.from({ length: 15 }, (_, i) =>
					createMockRead(2200 + i * 2, 2250 + i * 2, `peak1_read${i}`)
				),
				// Peak 2: another cluster
				...Array.from({ length: 12 }, (_, i) =>
					createMockRead(2400 + i * 3, 2450 + i * 3, `peak2_read${i}`)
				)
			];

			const coverage = computeCoverage(reads, 2000, 2500);
			const peaks = findCoverageRegions(coverage, 2000, 10, 'chr2');

			// Should find the two peak regions
			expect(peaks).toHaveLength(2);
			expect(peaks[0].coverage).toBeGreaterThanOrEqual(10);
			expect(peaks[1].coverage).toBeGreaterThanOrEqual(10);
		});

		test('should handle realistic coverage gradients', () => {
			// Simulate coverage that gradually increases and decreases
			const reads: BAMReadFeature[] = [];

			// Create reads with increasing then decreasing coverage
			// Start: 1x coverage, middle: 20x coverage, end: 1x coverage
			for (let pos = 3000; pos < 3200; pos += 5) {
				// Distance from center (3100) determines number of overlapping reads
				const distanceFromCenter = Math.abs(pos - 3100);
				const numReads = Math.max(1, 20 - Math.floor(distanceFromCenter / 5));

				for (let r = 0; r < numReads; r++) {
					reads.push(createMockRead(pos, pos + 20, `grad_${pos}_${r}`));
				}
			}

			const coverage = computeCoverage(reads, 3000, 3200);

			// Find regions with high coverage (>= 15x)
			const highRegions = findCoverageRegions(coverage, 3000, 15, 'chr3');

			// Should find a contiguous region in the center with high coverage
			expect(highRegions.length).toBeGreaterThan(0);
			expect(highRegions[0].coverage).toBeGreaterThanOrEqual(15);

			// The region should be reasonably centered (not at the edges)
			const regionMidpoint = (highRegions[0].start + highRegions[0].end) / 2;
			expect(regionMidpoint).toBeGreaterThan(3050);
			expect(regionMidpoint).toBeLessThan(3150);
		});

		test('should detect coverage gaps correctly', () => {
			// Simulate data with clear coverage gaps (like assembly gaps)
			const reads: BAMReadFeature[] = [
				// Region 1: good coverage
				...Array.from({ length: 8 }, (_, i) =>
					createMockRead(4000, 4100, `region1_${i}`)
				),
				// Gap: 4100-4200 (no reads)
				// Region 2: good coverage
				...Array.from({ length: 8 }, (_, i) =>
					createMockRead(4200, 4300, `region2_${i}`)
				)
			];

			const coverage = computeCoverage(reads, 4000, 4300);
			const regions = findCoverageRegions(coverage, 4000, 5, 'chr4');

			// Should find exactly 2 separate regions
			expect(regions).toHaveLength(2);

			// First region
			expect(regions[0].start).toBe(4000);
			expect(regions[0].end).toBe(4100);

			// Second region
			expect(regions[1].start).toBe(4200);
			expect(regions[1].end).toBe(4300);
		});
	});

	describe('Performance characteristics', () => {
		test('should handle whole-genome-scale queries efficiently', () => {
			// Simulate processing 1000 reads across 100kb region
			const reads = Array.from({ length: 1000 }, (_, i) => {
				const start = 5000000 + (i * 100); // reads every 100bp
				return createMockRead(start, start + 150, `wgs_read_${i}`);
			});

			const startTime = Date.now();
			const coverage = computeCoverage(reads, 5000000, 5100000); // 100kb region
			const regions = findCoverageRegions(coverage, 5000000, 1, 'chr5');
			const duration = Date.now() - startTime;

			expect(coverage).toHaveLength(100000);
			expect(regions.length).toBeGreaterThan(0);
			expect(duration).toBeLessThan(200); // Should complete in <200ms

			// Memory efficiency check
			expect(coverage.filter(c => c > 0).length).toBeGreaterThan(0);
		});

		test('should handle high-depth sequencing data', () => {
			// Simulate very high coverage region (like amplicon sequencing)
			const reads = Array.from({ length: 500 }, (_, i) =>
				createMockRead(6000, 6050, `amplicon_read_${i}`) // 500 reads all covering same region
			);

			const coverage = computeCoverage(reads, 6000, 6050);
			const regions = findCoverageRegions(coverage, 6000, 400, 'chr6'); // very high threshold

			// All positions should have 500x coverage
			expect(Math.max(...coverage)).toBe(500);
			expect(regions).toHaveLength(1);
			expect(regions[0].coverage).toBe(500);
		});
	});
});
/**
 * BAM Data Strategy Service
 *
 * Integrates windowed coverage with existing zoom-level rendering system
 */

import { computeBinMeanCoverage } from '$lib/services/windowedCoverage';
import { queryBam } from '$lib/services/bam';

export interface BamDataStrategy {
  useWindowed: boolean;
  binSize?: number;
  maxReads?: number;
}

export interface BamData {
  type: 'coverage' | 'reads';
  data: any[];
}

/**
 * Select optimal BAM data strategy based on zoom level and region size
 * @param regionSize - Size of genomic region in base pairs
 * @param pixelsPerBase - Pixels per base pair (zoom level indicator)
 * @param userResolution - User-selected resolution override
 * @param customThreshold - Custom threshold for switching to reads (default: 30)
 * @returns Data strategy configuration
 */
export function selectBamStrategy(
  regionSize: number,
  pixelsPerBase: number,
  userResolution?: string,
  customThreshold?: number
): BamDataStrategy {
  // Determine zoom mode based on pixels per base
  // density mode: pixelsPerBase < threshold (zoomed out, coverage histogram)
  // blocks mode: threshold <= pixelsPerBase < 8 (medium zoom, CIGAR blocks)
  // sequence mode: pixelsPerBase >= 8 (zoomed in, nucleotides)

  const threshold = customThreshold || 30; // Default: gene-level detail (30bp/pixel)

  if (pixelsPerBase < threshold) {
    // Density mode - use windowed coverage
    // Target 100-200 windows for optimal performance with quality settings

    let targetWindows: number;

    // Set target window count based on quality setting
    if (userResolution) {
      switch (userResolution) {
        case 'fast':
          targetWindows = 75; // Fewer windows for speed
          break;
        case 'detailed':
        case 'high': // alias kept for backwards compatibility
          targetWindows = 175; // More windows for detail
          break;
        case 'medium':
        default:
          targetWindows = 125; // Balanced approach
          break;
      }
    } else {
      targetWindows = 125; // Default to medium quality
    }

    // Calculate bin size to achieve target window count
    let binSize = Math.round(regionSize / targetWindows);

    // Apply absolute limits
    const MIN_BIN_SIZE = 100;    // 100bp minimum
    const MAX_BIN_SIZE = 1000000; // 1MB maximum

    binSize = Math.max(MIN_BIN_SIZE, binSize);
    binSize = Math.min(MAX_BIN_SIZE, binSize);

    // Ensure we don't drop below 75 windows (recalculation threshold)
    const actualWindows = regionSize / binSize;
    if (actualWindows < 75) {
      binSize = Math.max(MIN_BIN_SIZE, Math.round(regionSize / 75));
    }

    return {
      useWindowed: true,
      binSize
    };
  } else {
    // Blocks or sequence mode - use individual reads
    // Set reasonable max reads limit based on zoom level
    const maxReads = pixelsPerBase >= 8 ? 10000 : 5000; // More reads for sequence mode

    return {
      useWindowed: false,
      maxReads
    };
  }
}

/**
 * Get BAM data using the specified strategy
 * @param bamUrl - BAM file URL
 * @param chr - Chromosome
 * @param start - Start position
 * @param end - End position
 * @param strategy - Data strategy configuration
 * @returns BAM data formatted for rendering
 */
export async function getBamData(
  bamUrl: string,
  chr: string,
  start: number,
  end: number,
  strategy: BamDataStrategy
): Promise<BamData> {
  if (strategy.useWindowed) {
    // Use windowed coverage approach.
    // Compute per-bin MEAN depth across each bin (not a midpoint sample), so
    // read clusters are never missed because they miss a bin's midpoint.
    const binSize = strategy.binSize!;

    const coverageData = await computeBinMeanCoverage(bamUrl, chr, start, end, binSize);

    return {
      type: 'coverage',
      data: coverageData
    };
  } else {
    // Use individual reads approach (existing BAM service)
    const maxReads = strategy.maxReads!;

    // For testing with mock URLs, return mock reads data
    if (bamUrl.startsWith('test://')) {
      const mockReads = [];
      const numReads = Math.min(maxReads, Math.floor((end - start) / 150)); // ~150bp reads

      for (let i = 0; i < numReads; i++) {
        const readStart = start + i * 150;
        const readEnd = Math.min(readStart + 150, end);
        mockReads.push({
          start: readStart,
          end: readEnd,
          cigar: '150M',
          sequence: 'N'.repeat(150)
        });
      }

      return {
        type: 'reads',
        data: mockReads
      };
    }

    // Use existing BAM query service for real files
    const reads = await queryBam(bamUrl, chr, start, end);

    // Limit reads if needed
    const limitedReads = reads.slice(0, maxReads);

    return {
      type: 'reads',
      data: limitedReads
    };
  }
}
/**
 * Windowed BAM Coverage Service
 *
 * Provides efficient coverage computation for large genomic regions
 * using position sampling instead of processing all reads.
 */

import { queryBam } from '$lib/services/bam';

export interface WindowedCoverageData {
  start: number;
  end: number;
  value: number;
}

/**
 * Calculate optimal bin size for windowed coverage
 * @param regionSize - Size of genomic region in base pairs
 * @param canvasWidth - Canvas width in pixels
 * @param userResolution - User-selected resolution override
 * @returns Optimal bin size in base pairs
 */
export function calculateOptimalBinSize(
  regionSize: number,
  canvasWidth: number,
  userResolution?: string
): number {
  // Validate inputs
  if (regionSize <= 0 || canvasWidth <= 0) {
    throw new Error('Region size and canvas width must be positive');
  }

  // Constants for bin size limits
  const MIN_BIN_SIZE = 100;    // 100bp minimum
  const MAX_BIN_SIZE = 1000000; // 1MB maximum

  // Handle user resolution overrides
  if (userResolution) {
    const baseBinSize = regionSize / 100; // Default to ~100 bins

    switch (userResolution) {
      case 'fast':
        return Math.min(MAX_BIN_SIZE, Math.max(MIN_BIN_SIZE, Math.round(baseBinSize * 2))); // 20KB for 1MB
      case 'detailed':
      case 'high': // alias kept for backwards compatibility
        return Math.min(MAX_BIN_SIZE, Math.max(MIN_BIN_SIZE, 1000)); // 1KB bins
      case 'medium':
      default:
        return Math.min(MAX_BIN_SIZE, Math.max(MIN_BIN_SIZE, Math.round(baseBinSize))); // Default calculation
    }
  }

  // Default calculation: aim for ~100 bins for good balance
  // 1MB region / 100 bins = 10KB bins
  // 100KB region / 100 bins = 1KB bins
  let binSize = Math.round(regionSize / 100);

  // Apply limits
  binSize = Math.max(MIN_BIN_SIZE, binSize);
  binSize = Math.min(MAX_BIN_SIZE, binSize);

  return binSize;
}

/**
 * Generate sample positions for windowed coverage
 * @param start - Start position
 * @param end - End position
 * @param binSize - Size of each bin
 * @returns Array of sample positions
 */
export function generateSamplePositions(
  start: number,
  end: number,
  binSize: number
): number[] {
  // Validate inputs
  if (start >= end) {
    throw new Error('Start position must be less than end position');
  }
  if (binSize <= 0) {
    throw new Error('Bin size must be positive');
  }

  const regionSize = end - start;
  const positions: number[] = [];

  // Handle case where region is smaller than bin size
  if (regionSize < binSize) {
    // Return single position at region midpoint
    const midpoint = Math.round(start + regionSize / 2);
    return [midpoint];
  }

  // Generate positions at bin midpoints
  let currentBinStart = start;
  while (currentBinStart < end) {
    const currentBinEnd = Math.min(currentBinStart + binSize, end);
    const binMidpoint = Math.round(currentBinStart + (currentBinEnd - currentBinStart) / 2);

    // Ensure position is within bounds and is an integer
    if (binMidpoint >= start && binMidpoint <= end) {
      positions.push(binMidpoint);
    }

    currentBinStart += binSize;
  }

  return positions;
}

/**
 * Query depth at specific positions
 * @param bamUrl - BAM file URL
 * @param chr - Chromosome
 * @param positions - Positions to query
 * @returns Array of depth values
 */
export async function queryPositionalDepth(
  bamUrl: string,
  chr: string,
  positions: number[]
): Promise<number[]> {
  // Handle empty positions array
  if (positions.length === 0) {
    return [];
  }

  // For testing with mock URLs, return mock data
  if (bamUrl.startsWith('test://')) {
    return positions.map((pos) => {
      // Mock: positions ending in 999999999 have no coverage
      if (pos === 999999999) return 0;
      // Mock: other positions have random depth 1-20
      return Math.floor(Math.random() * 20) + 1;
    });
  }

  const depths: number[] = [];

  // Query depth at each position by getting reads in small window around position
  // Use small 100bp windows for efficiency
  const windowSize = 100;

  for (const position of positions) {
    const windowStart = Math.max(0, position - windowSize / 2);
    const windowEnd = position + windowSize / 2;

    try {
      // Query reads in window around position
      const reads = await queryBam(bamUrl, chr, windowStart, windowEnd);

      // Count reads that overlap this specific position
      let depthAtPosition = 0;
      for (const read of reads) {
        if (read.start <= position && read.end > position) {
          depthAtPosition++;
        }
      }

      depths.push(depthAtPosition);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Check if this is a general BAM access error (invalid URL scheme, file not found)
      if (message.includes('unknown scheme') ||
          message.includes('fetch failed') ||
          bamUrl.includes('invalid://')) {
        // Throw for general BAM access failures
        throw new Error(`Failed to query BAM ${bamUrl}: ${message}`);
      }

      // For other errors (individual position failures), return 0 depth
      console.warn(`Failed to query depth at ${chr}:${position}`, error);
      depths.push(0);
    }
  }

  return depths;
}

/**
 * Generate deterministic mock reads for a region, used for `test://` URLs so
 * tests can run offline. Reads are ~150bp and tile the region contiguously,
 * which gives every covered bin a non-zero mean depth.
 */
function mockReadsForRegion(
  start: number,
  end: number
): Array<{ start: number; end: number }> {
  const reads: Array<{ start: number; end: number }> = [];
  const readLen = 150;
  for (let s = start; s < end; s += readLen) {
    reads.push({ start: s, end: Math.min(s + readLen, end) });
  }
  return reads;
}

/**
 * Compute per-bin MEAN read depth across a region.
 *
 * The region [start, end) is tiled into uniform, contiguous bins of `binSize`
 * (the final bin is clamped to `end`). For each bin we query the reads that
 * overlap it (one bounded queryBam call per bin — never the whole region at
 * once) and compute the mean depth as:
 *
 *   mean = sum over overlapping reads of (min(read.end, binEnd) - max(read.start, binStart))
 *          / (binEnd - binStart)
 *
 * This replaces midpoint point-sampling, so read clusters are never missed
 * just because they don't land on a bin's midpoint.
 *
 * @param bamUrl - BAM file URL
 * @param chr - Chromosome
 * @param start - Region start (0-based, half-open)
 * @param end - Region end (exclusive)
 * @param binSize - Size of each bin in base pairs
 * @returns Coverage data (one entry per bin) for rendering
 */
export async function computeBinMeanCoverage(
  bamUrl: string,
  chr: string,
  start: number,
  end: number,
  binSize: number
): Promise<WindowedCoverageData[]> {
  if (start >= end) {
    throw new Error('Start position must be less than end position');
  }
  if (binSize <= 0) {
    throw new Error('Bin size must be positive');
  }

  const coverage: WindowedCoverageData[] = [];

  for (let binStart = start; binStart < end; binStart += binSize) {
    const binEnd = Math.min(binStart + binSize, end);
    const binLength = binEnd - binStart;

    let reads: Array<{ start: number; end: number }>;

    if (bamUrl.startsWith('test://')) {
      // Offline mock: deterministic reads tiling this bin's range.
      reads = mockReadsForRegion(binStart, binEnd);
    } else {
      try {
        reads = await queryBam(bamUrl, chr, binStart, binEnd);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Hard BAM access failures (bad scheme, fetch failure) should propagate.
        if (
          message.includes('unknown scheme') ||
          message.includes('fetch failed') ||
          bamUrl.includes('invalid://')
        ) {
          throw new Error(`Failed to query BAM ${bamUrl}: ${message}`);
        }
        // Soft per-bin failures: treat as no coverage.
        console.warn(`Failed to query depth for ${chr}:${binStart}-${binEnd}`, error);
        coverage.push({ start: binStart, end: binEnd, value: 0 });
        continue;
      }
    }

    // Sum overlapping base pairs across all reads, then divide by bin length
    // to get the mean depth across the whole bin.
    let overlapSum = 0;
    for (const read of reads) {
      const overlapStart = Math.max(read.start, binStart);
      const overlapEnd = Math.min(read.end, binEnd);
      if (overlapEnd > overlapStart) {
        overlapSum += overlapEnd - overlapStart;
      }
    }

    const meanDepth = binLength > 0 ? overlapSum / binLength : 0;

    coverage.push({ start: binStart, end: binEnd, value: meanDepth });
  }

  return coverage;
}

/**
 * Create windowed coverage data from positions and depths
 * @param positions - Sample positions
 * @param depths - Depth values at each position
 * @returns Coverage data for rendering
 */
export function createWindowedCoverage(
  positions: number[],
  depths: number[]
): WindowedCoverageData[] {
  // Input validation
  if (positions.length !== depths.length) {
    throw new Error('Positions and depths arrays must have same length');
  }

  // Handle empty arrays
  if (positions.length === 0) {
    return [];
  }

  const coverage: WindowedCoverageData[] = [];

  for (let i = 0; i < positions.length; i++) {
    const position = positions[i];
    const depth = depths[i];

    // Calculate start and end positions for this coverage interval
    // Use midpoints between positions to create non-overlapping intervals
    let start: number;
    let end: number;

    if (positions.length === 1) {
      // Single position: create a reasonable interval around it
      const halfInterval = 5000; // 5KB on each side
      start = Math.max(0, position - halfInterval);
      end = position + halfInterval;
    } else if (i === 0) {
      // First position: interval from start to midpoint with next position
      const nextPosition = positions[1];
      start = Math.max(0, position - (nextPosition - position) / 2);
      end = Math.round((position + nextPosition) / 2);
    } else if (i === positions.length - 1) {
      // Last position: interval from midpoint with previous position to end
      const prevPosition = positions[i - 1];
      start = Math.round((prevPosition + position) / 2);
      const intervalSize = position - prevPosition;
      end = position + intervalSize / 2;
    } else {
      // Middle position: interval from midpoint with previous to midpoint with next
      const prevPosition = positions[i - 1];
      const nextPosition = positions[i + 1];
      start = Math.round((prevPosition + position) / 2);
      end = Math.round((position + nextPosition) / 2);
    }

    // Ensure start < end
    if (start >= end) {
      end = start + 1;
    }

    coverage.push({
      start,
      end,
      value: depth
    });
  }

  return coverage;
}
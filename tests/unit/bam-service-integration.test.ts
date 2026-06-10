/**
 * BAM Service Quality Integration Tests
 *
 * Tests that the BAM service correctly reads quality settings from the coverage quality store
 * This test should fail initially (Red phase) then pass after integration (Green phase)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBamCoverageData } from '$lib/services/bam';

// Mock the coverage quality store
const mockCoverageQuality = {
  getQualityForTrackType: vi.fn()
};

// Mock the store module
vi.mock('$lib/stores/coverageQuality.svelte', () => ({
  useCoverageQuality: () => mockCoverageQuality
}));

// Mock the bamDataStrategy module to spy on selectBamStrategy calls
const mockSelectBamStrategy = vi.fn();
const mockGetBamData = vi.fn();

vi.mock('$lib/services/bamDataStrategy', () => ({
  selectBamStrategy: mockSelectBamStrategy,
  getBamData: mockGetBamData
}));

// Mock the core bam query function
vi.mock('$lib/services/bam', async () => {
  const actual = await vi.importActual('$lib/services/bam');
  return {
    ...actual,
    queryBam: vi.fn().mockResolvedValue([])
  };
});

describe('BAM Service Quality Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockSelectBamStrategy.mockReturnValue({
      useWindowed: true,
      binSize: 8000
    });

    mockGetBamData.mockResolvedValue({
      type: 'coverage',
      data: []
    });
  });

  it('should pass quality setting from store to strategy selector for large regions', async () => {
    // Arrange - Set up mock to return 'fast' quality
    mockCoverageQuality.getQualityForTrackType.mockReturnValue('fast');

    // Act - Call getBamCoverageData with conditions that trigger windowed coverage
    // (pixelsPerBase < 1 and regionSize > 50000)
    await getBamCoverageData(
      'test.bam',
      'chr1',
      1000000,
      2000000,  // 1MB region
      { pixelsPerBase: 0.5 } // Density mode
    );

    // Assert - Strategy selector should have been called with quality parameter
    expect(mockCoverageQuality.getQualityForTrackType).toHaveBeenCalledWith('bam');
    expect(mockSelectBamStrategy).toHaveBeenCalledWith(
      1000000, // regionSize
      0.5,     // pixelsPerBase
      'fast'   // userResolution - this should be passed but currently isn't
    );
  });

  it('should pass different quality settings correctly', async () => {
    const testCases = ['fast', 'medium', 'detailed'];

    for (const quality of testCases) {
      // Arrange
      mockCoverageQuality.getQualityForTrackType.mockReturnValue(quality);

      // Act
      await getBamCoverageData(
        'test.bam',
        'chr1',
        1000000,
        2000000,
        { pixelsPerBase: 0.1 }
      );

      // Assert - Should pass the correct quality setting
      expect(mockSelectBamStrategy).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        quality // This parameter should match the store value
      );
    }
  });

  it('should handle missing quality store gracefully', async () => {
    // Arrange - Mock store to return undefined (fallback case)
    mockCoverageQuality.getQualityForTrackType.mockReturnValue(undefined);

    // Act
    await getBamCoverageData(
      'test.bam',
      'chr1',
      1000000,
      2000000,
      { pixelsPerBase: 0.5 }
    );

    // Assert - Should still call strategy selector (with undefined quality)
    expect(mockSelectBamStrategy).toHaveBeenCalledWith(
      1000000,
      0.5,
      undefined
    );
  });

});
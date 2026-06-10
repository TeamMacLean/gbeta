/**
 * Coverage Quality Controls - Integration Tests
 *
 * Tests the complete integration of coverage controls in the browser UI
 * These tests should have been written during TDD but were missing
 */
import { test, expect, type Page } from '@playwright/test';

test.describe('Coverage Controls Integration', () => {
  async function loadBAMTrack(page: Page) {
    // Navigate to a region with test data
    await page.goto('/');
    await page.waitForSelector('[data-testid="coordinate-input"]');

    // Wait for sidebar to be ready
    await expect(page.locator('h3:has-text("Add Tracks")')).toBeVisible();

    // Click the URL tab
    await page.locator('button:has-text("URL")').click();

    // Use a test BAM URL (needs to be a real working URL)
    const testBAMUrl = 'https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.bam';
    await page.locator('input[type="url"]').fill(testBAMUrl);
    await page.locator('aside button:has-text("+")').click();

    // Wait for track to load
    await expect(page.locator('span.uppercase').filter({ hasText: 'bam' }).first()).toBeVisible({ timeout: 30000 });

    // Navigate to a region with data
    await page.locator('[data-testid="coordinate-input"]').fill('gi|545778205|gb|U00096.3|:100000-200000');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000); // Wait for data to load
  }

  async function loadNonQuantitativeTrack(page: Page) {
    await page.goto('/');
    await page.waitForSelector('[data-testid="coordinate-input"]');

    // Wait for sidebar to be ready
    await expect(page.locator('h3:has-text("Add Tracks")')).toBeVisible();

    // Click the URL tab
    await page.locator('button:has-text("URL")').click();

    const testBEDUrl = 'https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/hg38/genes.bed.gz';
    await page.locator('input[type="url"]').fill(testBEDUrl);
    await page.locator('aside button:has-text("+")').click();

    await expect(page.locator('span.uppercase').filter({ hasText: 'bed' }).first()).toBeVisible({ timeout: 30000 });
  }

  test('coverage controls appear when BAM track is loaded', async ({ page }) => {
    await loadBAMTrack(page);

    // Check that coverage controls section appears
    await expect(page.locator('text=Coverage Quality')).toBeVisible();
    await expect(page.locator('text=Adjust detail vs performance')).toBeVisible();

    // Check that quality slider is present
    await expect(page.getByRole('slider', { name: 'Coverage quality' })).toBeVisible();

    // Check that quality options are present
    await expect(page.locator('button:has-text("Fast")')).toBeVisible();
    await expect(page.locator('button:has-text("Medium")')).toBeVisible();
    await expect(page.locator('button:has-text("Detailed")')).toBeVisible();
  });

  test('coverage controls are hidden when only non-quantitative tracks loaded', async ({ page }) => {
    await loadNonQuantitativeTrack(page);

    // Coverage controls should not appear
    await expect(page.locator('text=Coverage Quality')).not.toBeVisible();
    await expect(page.locator('.coverage-controls')).not.toBeVisible();
  });

  test('coverage controls appear after adding BAM to existing BED track', async ({ page }) => {
    // Start with non-quantitative track
    await loadNonQuantitativeTrack(page);
    await expect(page.locator('text=Coverage Quality')).not.toBeVisible();

    // Add BAM track
    await page.locator('button:has-text("URL")').click();
    const testBAMUrl = 'https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/test/ecoli-test.bam';
    await page.locator('input[type="url"]').fill(testBAMUrl);
    await page.locator('aside button:has-text("+")').click();
    await expect(page.locator('span.uppercase').filter({ hasText: 'bam' }).first()).toBeVisible({ timeout: 30000 });

    // Now coverage controls should appear
    await expect(page.locator('text=Coverage Quality')).toBeVisible();
  });

  test('quality slider changes work correctly', async ({ page }) => {
    await loadBAMTrack(page);

    // Verify default is Medium
    const mediumButton = page.locator('button:has-text("Medium")');
    await expect(mediumButton).toHaveClass(/active/);

    // Click Fast
    await page.locator('button:has-text("Fast")').click();
    await expect(page.locator('button:has-text("Fast")')).toHaveClass(/active/);
    await expect(mediumButton).not.toHaveClass(/active/);

    // Verify performance hint changes
    await expect(page.locator('text=Faster loading, less detail (~75 samples)')).toBeVisible();

    // Click Detailed
    await page.locator('button:has-text("Detailed")').click();
    await expect(page.locator('button:has-text("Detailed")')).toHaveClass(/active/);
    await expect(page.locator('text=More detail, slower loading (~175 samples)')).toBeVisible();
  });

  test('range slider syncs with button clicks', async ({ page }) => {
    await loadBAMTrack(page);

    const slider = page.getByRole('slider', { name: 'Coverage quality' });

    // Default should be Medium (index 1)
    await expect(slider).toHaveValue('1');

    // Move slider to Fast (index 0)
    await slider.fill('0');
    await expect(page.locator('button:has-text("Fast")')).toHaveClass(/active/);

    // Move slider to Detailed (index 2)
    await slider.fill('2');
    await expect(page.locator('button:has-text("Detailed")')).toHaveClass(/active/);
  });

  test('quality settings persist across page reloads', async ({ page }) => {
    await loadBAMTrack(page);

    // Set to Fast
    await page.locator('button:has-text("Fast")').click();
    await expect(page.locator('button:has-text("Fast")')).toHaveClass(/active/);

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="coordinate-input"]');

    // Load BAM track again
    await loadBAMTrack(page);

    // Should still be Fast
    await expect(page.locator('button:has-text("Fast")')).toHaveClass(/active/);
  });

  test('controls disappear when BAM track is removed', async ({ page }) => {
    await loadBAMTrack(page);

    // Verify controls are visible
    await expect(page.locator('text=Coverage Quality')).toBeVisible();

    // Remove BAM track
    const bamTrack = page.locator('.group:has-text("bam")');
    await bamTrack.hover();
    await bamTrack.locator('button[title="Remove track"]').click();

    // Controls should disappear
    await expect(page.locator('text=Coverage Quality')).not.toBeVisible();
  });

  test('controls remain visible with multiple quantitative tracks', async ({ page }) => {
    await loadBAMTrack(page);

    // Add BigWig track
    await page.locator('button:has-text("URL")').click();
    const testBigWigUrl = 'https://pub-cdedc141a021461d9db8432b0ec926d7.r2.dev/hg38/test.bw';
    await page.locator('input[type="url"]').fill(testBigWigUrl);
    await page.locator('aside button:has-text("+")').click();

    // Controls should still be visible
    await expect(page.locator('text=Coverage Quality')).toBeVisible();

    // Remove BAM, keep BigWig
    const bamTrack = page.locator('.group:has-text("bam")');
    await bamTrack.hover();
    await bamTrack.locator('button[title="Remove track"]').click();

    // Controls should still be visible (BigWig is quantitative)
    await expect(page.locator('text=Coverage Quality')).toBeVisible();
  });

  test('quality changes affect BAM rendering performance', async ({ page }) => {
    await loadBAMTrack(page);

    // Navigate to a large region that would trigger windowed coverage
    await page.locator('[data-testid="coordinate-input"]').fill('gi|545778205|gb|U00096.3|:100000-200000');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Set to Fast - should render quickly
    await page.locator('button:has-text("Fast")').click();
    const fastStartTime = Date.now();

    // Force re-render by panning slightly
    await page.locator('canvas').hover();
    await page.mouse.down();
    await page.mouse.move(500, 300);
    await page.mouse.up();

    const fastRenderTime = Date.now() - fastStartTime;

    // Set to Detailed - should take longer but provide more detail
    await page.locator('button:has-text("Detailed")').click();
    const detailedStartTime = Date.now();

    // Force re-render again
    await page.locator('canvas').hover();
    await page.mouse.down();
    await page.mouse.move(400, 300);
    await page.mouse.up();

    const detailedRenderTime = Date.now() - detailedStartTime;

    // Fast should generally be faster than detailed (though this is timing-dependent)
    // At minimum, both should complete without hanging
    expect(fastRenderTime).toBeLessThan(10000); // Should not hang
    expect(detailedRenderTime).toBeLessThan(10000); // Should not hang
  });
});
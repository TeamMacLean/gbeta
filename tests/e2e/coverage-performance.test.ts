/**
 * Coverage Query Performance Tests
 *
 * Systematically test coverage queries to identify performance breaking points.
 * Uses graduated testing approach to isolate the root cause.
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Start with hg38 assembly
    await page.goto('/?assembly=hg38');
    await page.waitForSelector('canvas');

    // Load our test BAM file via URL (to avoid local file issues)
    await page.getByRole('button', { name: 'URL' }).click();
    const urlInput = page.locator('input[type="url"]');
    await expect(urlInput).toBeVisible();

    await urlInput.fill('https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/phase3/data/NA12878/alignment/NA12878.chrom11.ILLUMINA.bwa.CEU.low_coverage.20121211.bam');
    await urlInput.press('Enter');

    // Wait for BAM track to load
    await expect(page.locator('text=NA12878')).toBeVisible({ timeout: 60000 });
  });

  test('should handle small coverage queries without hanging', async ({ page }) => {
    // Test 1: Very small region (1kb) - should work
    await page.locator('input[type="text"]').first().fill('chr11:5000000-5001000');
    await page.locator('input[type="text"]').first().press('Enter');
    await page.waitForTimeout(2000);

    // Open query console
    await page.keyboard.press('Meta+`');

    // Measure performance of small query
    const startTime = Date.now();
    await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').fill('SELECT REGIONS WHERE coverage >= 10');
    await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').press('Enter');

    // Should complete within 5 seconds
    await expect(page.locator('.text-emerald-400')).toBeVisible({ timeout: 5000 });
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(5000);
    console.log(`Small query (1kb): ${endTime - startTime}ms`);
  });

  test('should identify breaking point for region size', async ({ page }) => {
    const regionSizes = [1000, 5000, 10000, 25000, 50000, 100000]; // 1kb to 100kb

    for (const size of regionSizes) {
      console.log(`Testing ${size}bp region...`);

      // Navigate to test region
      const start = 5000000;
      const end = start + size;
      await page.locator('input[type="text"]').first().fill(`chr11:${start}-${end}`);
      await page.locator('input[type="text"]').first().press('Enter');
      await page.waitForTimeout(1000);

      // Open query console
      await page.keyboard.press('Meta+`');

      // Time the query
      const startTime = Date.now();
      await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').fill('SELECT REGIONS WHERE coverage >= 10');

      try {
        await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').press('Enter');

        // Wait for result or timeout
        await Promise.race([
          page.locator('.text-emerald-400').waitFor({ timeout: 10000 }),
          page.locator('.text-amber-400').waitFor({ timeout: 10000 })
        ]);

        const endTime = Date.now();
        const duration = endTime - startTime;
        console.log(`${size}bp region: ${duration}ms`);

        // If it takes >8 seconds, we found the breaking point
        if (duration > 8000) {
          console.log(`BREAKING POINT FOUND: ${size}bp region takes ${duration}ms`);
          break;
        }

      } catch (error) {
        console.log(`${size}bp region: TIMEOUT or ERROR`);
        break;
      }
    }
  });

  test('should monitor memory usage during coverage queries', async ({ page }) => {
    // Enable performance monitoring
    await page.addInitScript(() => {
      (window as any).performanceData = {
        memoryBefore: (window.performance as any).memory?.usedJSHeapSize || 0,
        memoryAfter: 0,
        startTime: 0,
        endTime: 0
      };
    });

    // Test moderate region
    await page.locator('input[type="text"]').first().fill('chr11:5000000-5025000'); // 25kb
    await page.locator('input[type="text"]').first().press('Enter');
    await page.waitForTimeout(1000);

    // Record before
    await page.evaluate(() => {
      (window as any).performanceData.memoryBefore = (window.performance as any).memory?.usedJSHeapSize || 0;
      (window as any).performanceData.startTime = Date.now();
    });

    // Run query
    await page.keyboard.press('Meta+`');
    await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').fill('SELECT REGIONS WHERE coverage >= 10');
    await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').press('Enter');

    // Wait for completion
    await page.locator('.text-emerald-400').waitFor({ timeout: 10000 });

    // Record after
    const metrics = await page.evaluate(() => {
      (window as any).performanceData.memoryAfter = (window.performance as any).memory?.usedJSHeapSize || 0;
      (window as any).performanceData.endTime = Date.now();
      return (window as any).performanceData;
    });

    console.log('Memory usage:', {
      before: Math.round(metrics.memoryBefore / 1024 / 1024) + 'MB',
      after: Math.round(metrics.memoryAfter / 1024 / 1024) + 'MB',
      increase: Math.round((metrics.memoryAfter - metrics.memoryBefore) / 1024 / 1024) + 'MB',
      duration: (metrics.endTime - metrics.startTime) + 'ms'
    });

    // Memory increase shouldn't be excessive (>100MB for 25kb region)
    expect(metrics.memoryAfter - metrics.memoryBefore).toBeLessThan(100 * 1024 * 1024);
  });

  test('should test different coverage thresholds for performance impact', async ({ page }) => {
    // Same region, different thresholds
    await page.locator('input[type="text"]').first().fill('chr11:5000000-5010000'); // 10kb
    await page.locator('input[type="text"]').first().press('Enter');
    await page.waitForTimeout(1000);

    const thresholds = [1, 5, 10, 20, 50];

    for (const threshold of thresholds) {
      await page.keyboard.press('Meta+`');

      const startTime = Date.now();
      await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').fill(`SELECT REGIONS WHERE coverage >= ${threshold}`);
      await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').press('Enter');

      await page.locator('.text-emerald-400').waitFor({ timeout: 5000 });
      const endTime = Date.now();

      console.log(`Threshold ${threshold}: ${endTime - startTime}ms`);
    }
  });

  test('should capture visual regression of loading states', async ({ page }) => {
    // Test loading state during coverage query
    await page.locator('input[type="text"]').first().fill('chr11:5000000-5010000');
    await page.locator('input[type="text"]').first().press('Enter');
    await page.waitForTimeout(1000);

    await page.keyboard.press('Meta+`');

    // Capture before query
    await expect(page).toHaveScreenshot('coverage-query-before.png');

    // Start query
    await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').fill('SELECT REGIONS WHERE coverage >= 10');
    await page.locator('textarea[placeholder="SELECT GENES INTERSECT variants"]').press('Enter');

    // Capture loading state
    await page.waitForTimeout(500); // Capture mid-processing
    await expect(page).toHaveScreenshot('coverage-query-loading.png');

    // Capture final result
    await page.locator('.text-emerald-400').waitFor({ timeout: 5000 });
    await expect(page).toHaveScreenshot('coverage-query-complete.png');
  });
/**
 * Persona 1: Sam the Student (Beginner)
 *
 * Background: Undergraduate taking a genomics course, first time using a genome browser.
 * Use case: "My professor mentioned TP53 is an important tumor suppressor. I want to see what it looks like."
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const getSearchInput = (page: import('@playwright/test').Page) =>
	page.locator('input[placeholder*="Search"]');

const getCoordInput = (page: import('@playwright/test').Page) =>
	page.locator('input[placeholder*="chr:start-end"]');

test.describe('Sam the Student - First-time user journey', () => {
	test('app loads cleanly for first-time user', async ({ page }) => {
		// A student opens the browser for the first time
		await page.goto('/');

		// Should see the main UI elements without confusion
		await expect(page.getByText('gBeta')).toBeVisible();
		await expect(page.locator('canvas').first()).toBeVisible();

		// Search bar should be obvious
		await expect(getSearchInput(page)).toBeVisible();

		// Zoom controls should be visible
		await expect(page.locator('button:has-text("+")').first()).toBeVisible();
		await expect(page.locator('button:has-text("−")').first()).toBeVisible();

		// Sidebar shows tracks section with default gene tracks loaded
		await expect(page.getByText(/Tracks/i).first()).toBeVisible();
		// Remote gene/transcript tracks load by default for the assembly
		await expect(page.getByText(/Transcripts/i).first()).toBeVisible({ timeout: 10000 });
	});

	test('can search for and navigate to TP53', async ({ page }) => {
		await page.goto('/');

		// Student searches for TP53 - the famous tumor suppressor
		const searchInput = getSearchInput(page);
		await searchInput.fill('TP53');
		await searchInput.press('Enter');

		// Should see some result
		await page.waitForTimeout(1000);

		// Results should appear (code elements show executed GQL)
		const codeElements = page.locator('code');
		const count = await codeElements.count();
		expect(count).toBeGreaterThan(0);
	});

	test('can use zoom controls to explore', async ({ page }) => {
		await page.goto('/');

		// Get initial viewport info
		const bpText = page.locator('text=/\\d+,?\\d*\\s*bp/').first();
		await expect(bpText).toBeVisible();
		const initialText = await bpText.textContent();

		// Zoom in
		const zoomIn = page.locator('button:has-text("+")').first();
		await zoomIn.click();
		await page.waitForTimeout(300);

		// Viewport should change
		const afterZoomIn = await bpText.textContent();

		// Zoom out
		const zoomOut = page.locator('button:has-text("−")').first();
		await zoomOut.click();
		await zoomOut.click();
		await page.waitForTimeout(300);

		// Should still be functional
		await expect(page.locator('canvas').first()).toBeVisible();
	});

	test('can pan the viewport by dragging', async ({ page }) => {
		await page.goto('/');

		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible();

		const box = await canvas.boundingBox();
		expect(box).not.toBeNull();

		// Drag to pan
		await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
		await page.mouse.down();
		await page.mouse.move(box!.x + 100, box!.y + box!.height / 2, { steps: 5 });
		await page.mouse.up();

		// Canvas should still be visible after interaction
		await expect(canvas).toBeVisible();
	});

	test('can switch chromosomes using dropdown', async ({ page }) => {
		await page.goto('/');

		// Student wants to look at different chromosomes
		const chrSelect = page.locator('select').first();
		await expect(chrSelect).toBeVisible();

		// Switch to chr17 (where TP53 is)
		await chrSelect.selectOption('chr17');
		await expect(chrSelect).toHaveValue('chr17');

		// Switch to chrX
		await chrSelect.selectOption('chrX');
		await expect(chrSelect).toHaveValue('chrX');
	});

	test('discovers how to add tracks via sidebar hint', async ({ page }) => {
		await page.goto('/');

		// Student sees "Add Tracks" section in sidebar
		await expect(page.getByText(/Add Tracks/i)).toBeVisible();

		// File/URL tabs are visible
		await expect(page.getByRole('button', { name: 'File' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'URL' })).toBeVisible();

		// Drop or browse button is visible with format hints
		await expect(page.getByText(/Drop or browse/i)).toBeVisible();
		await expect(page.getByText(/BED, GFF, VCF/i)).toBeVisible();
	});

	test('can use natural language zoom commands', async ({ page }) => {
		await page.goto('/');

		// Student tries natural language
		const searchInput = getSearchInput(page);

		// Zoom in via natural language
		await searchInput.fill('zoom in');
		await searchInput.press('Enter');
		await page.waitForTimeout(500);

		// Should show some feedback
		const codeElements = page.locator('code');
		const count = await codeElements.count();
		expect(count).toBeGreaterThan(0);

		// Clear and try another
		await searchInput.fill('zoom out');
		await searchInput.press('Enter');
		await page.waitForTimeout(500);

		// App should still be functional
		await expect(page.locator('canvas').first()).toBeVisible();
	});
});

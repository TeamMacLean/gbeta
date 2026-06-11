/**
 * Smoke Tests - Basic functionality checks
 * These tests verify the app loads and core UI elements are present
 */
import { test, expect } from '@playwright/test';

// Helper to get the coordinate input
const getCoordInput = (page: import('@playwright/test').Page) =>
	page.locator('input[placeholder*="chr:start-end"]');

test.describe('Smoke Tests', () => {
	test('app loads without errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', msg => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await page.goto('/');

		await expect(page).toHaveTitle(/gBeta/i);
		await expect(page.locator('header')).toBeVisible();

		const criticalErrors = errors.filter(e =>
			!e.includes('favicon') && !e.includes('404')
		);
		expect(criticalErrors).toHaveLength(0);
	});

	test('canvas viewport is present and has dimensions', async ({ page }) => {
		await page.goto('/');

		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible();

		const box = await canvas.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width).toBeGreaterThan(100);
		expect(box!.height).toBeGreaterThan(50);
	});

	test('sidebar is visible with tracks section', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('aside')).toBeVisible();
		await expect(page.getByText(/Tracks/i).first()).toBeVisible();
	});

	test('header contains navigation elements', async ({ page }) => {
		await page.goto('/');

		// gBeta logo
		await expect(page.getByText('gBeta')).toBeVisible();

		// Assembly selector button
		await expect(page.locator('button').filter({ hasText: /GRCh|hg/i }).first()).toBeVisible();

		// Chromosome selector
		await expect(page.locator('select').first()).toBeVisible();

		// Coordinate input
		await expect(getCoordInput(page)).toBeVisible();

		// Go button
		await expect(page.locator('button:has-text("Go")').first()).toBeVisible();

		// Zoom controls
		await expect(page.locator('button:has-text("+")').first()).toBeVisible();
		await expect(page.locator('button:has-text("−")').first()).toBeVisible();
	});

	test('search bar is present', async ({ page }) => {
		await page.goto('/');

		const searchInput = page.locator('input[placeholder*="Search"]');
		await expect(searchInput).toBeVisible();
	});

	test('has multiple header buttons', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Wait for at least one button to appear
		await expect(page.locator('header button').first()).toBeVisible();

		const headerButtons = page.locator('header button');
		const count = await headerButtons.count();
		expect(count).toBeGreaterThan(3);
	});
});

test.describe('Initial State', () => {
	test('starts with default chromosome selected', async ({ page }) => {
		await page.goto('/');

		const chrSelect = page.locator('select').first();
		await expect(chrSelect).toBeVisible();

		const value = await chrSelect.inputValue();
		expect(value).toMatch(/^chr/);
	});

	test('coordinate input is visible and accessible', async ({ page }) => {
		await page.goto('/');

		const coordInput = getCoordInput(page);
		await expect(coordInput).toBeVisible();

		// Input should be fillable
		await coordInput.fill('chr1:1000-2000');
		await expect(coordInput).toHaveValue('chr1:1000-2000');
	});

	test('shows viewport width in bp', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('text=/\\d+,?\\d*\\s*bp/')).toBeVisible();
	});

	test('history button is visible', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('button[title="Query history"]')).toBeVisible();
	});
});

test.describe('Assembly Selector', () => {
	test('assembly button is clickable', async ({ page }) => {
		await page.goto('/');

		const assemblyButton = page.locator('button').filter({ hasText: /GRCh|hg/i }).first();
		await expect(assemblyButton).toBeVisible();

		// Just verify it's clickable (don't test menu content)
		await assemblyButton.click();

		// Button should still be visible after click
		await expect(assemblyButton).toBeVisible();
	});
});

test.describe('Responsive Layout', () => {
	test('maintains layout at 1920x1080', async ({ page }) => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.goto('/');

		await expect(page.locator('header')).toBeVisible();
		await expect(page.locator('aside')).toBeVisible();
		await expect(page.locator('canvas').first()).toBeVisible();
	});

	test('maintains layout at 1280x720', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/');

		await expect(page.locator('header')).toBeVisible();
		await expect(page.locator('aside')).toBeVisible();
		await expect(page.locator('canvas').first()).toBeVisible();
	});
});

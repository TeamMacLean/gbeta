import { test, expect } from '@playwright/test';

test.describe('Theme Switching', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage to start fresh
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
	});

	test('app loads with light theme by default', async ({ page }) => {
		await page.goto('/');
		// Wait for app to initialize
		await page.waitForSelector('[data-testid="header"]', { timeout: 10000 }).catch(() => {
			// Header might not have testid, check for any content
		});
		await page.waitForTimeout(500);

		// Check that documentElement has 'light' class or no dark class
		const htmlClass = await page.evaluate(() => document.documentElement.className);
		// Light is default, so either 'light' class or no theme class means light
		expect(htmlClass.includes('dark')).toBe(false);
		expect(htmlClass.includes('high-contrast')).toBe(false);
	});

	test('can switch to dark theme via Settings', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);

		// Open Settings panel
		const settingsButton = page.locator('button').filter({ hasText: /settings/i }).first();
		if (await settingsButton.isVisible()) {
			await settingsButton.click();
		} else {
			// Try gear icon button
			const gearButton = page.locator('button[title*="Settings"], button[aria-label*="Settings"]').first();
			await gearButton.click();
		}

		// Click Display tab
		await page.getByRole('button', { name: 'Display' }).click();

		// Click Dark theme button
		await page.getByRole('button', { name: /dark/i }).first().click();

		// Verify dark class is applied
		const htmlClass = await page.evaluate(() => document.documentElement.className);
		expect(htmlClass).toContain('dark');
	});

	test('can switch to high-contrast theme via Settings', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);

		// Open Settings panel
		const settingsButton = page.locator('button').filter({ hasText: /settings/i }).first();
		if (await settingsButton.isVisible()) {
			await settingsButton.click();
		} else {
			const gearButton = page.locator('button[title*="Settings"], button[aria-label*="Settings"]').first();
			await gearButton.click();
		}

		// Click Display tab
		await page.getByRole('button', { name: 'Display' }).click();

		// Click High Contrast theme button
		await page.getByRole('button', { name: /high.?contrast/i }).first().click();

		// Verify high-contrast class is applied
		const htmlClass = await page.evaluate(() => document.documentElement.className);
		expect(htmlClass).toContain('high-contrast');
	});

	test('theme persists across page reload', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);

		// Open Settings and switch to dark theme
		const settingsButton = page.locator('button').filter({ hasText: /settings/i }).first();
		if (await settingsButton.isVisible()) {
			await settingsButton.click();
		} else {
			const gearButton = page.locator('button[title*="Settings"], button[aria-label*="Settings"]').first();
			await gearButton.click();
		}

		await page.getByRole('button', { name: 'Display' }).click();
		await page.getByRole('button', { name: /dark/i }).first().click();

		// Verify dark is set
		let htmlClass = await page.evaluate(() => document.documentElement.className);
		expect(htmlClass).toContain('dark');

		// Reload page
		await page.reload();
		await page.waitForTimeout(500);

		// Verify dark theme persists
		htmlClass = await page.evaluate(() => document.documentElement.className);
		expect(htmlClass).toContain('dark');
	});

	test('palette can be changed via Settings', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);

		// Open Settings panel
		const settingsButton = page.locator('button').filter({ hasText: /settings/i }).first();
		if (await settingsButton.isVisible()) {
			await settingsButton.click();
		} else {
			const gearButton = page.locator('button[title*="Settings"], button[aria-label*="Settings"]').first();
			await gearButton.click();
		}

		// Click Display tab
		await page.getByRole('button', { name: 'Display' }).click();

		// Look for palette options (Set2, Dark2, Paired)
		const dark2Button = page.getByRole('button', { name: /dark2/i });
		if (await dark2Button.isVisible()) {
			await dark2Button.click();

			// Verify localStorage has updated palette
			const stored = await page.evaluate(() => {
				const settings = localStorage.getItem('gbeta-theme');
				return settings ? JSON.parse(settings) : null;
			});
			expect(stored?.palette).toBe('dark2');
		}
	});

	test('light theme has correct background color', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);

		// Get computed background color
		const bgColor = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary').trim();
		});

		// Light theme should have white or near-white background
		expect(bgColor).toBe('#ffffff');
	});

	test('dark theme has correct background color', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);

		// Set dark theme via localStorage
		await page.evaluate(() => {
			localStorage.setItem('gbeta-theme', JSON.stringify({ mode: 'dark', palette: 'set2' }));
		});
		await page.reload();
		await page.waitForTimeout(500);

		// Get computed background color
		const bgColor = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary').trim();
		});

		// Dark theme should have dark background
		expect(bgColor).toBe('#1a1a2e');
	});
});

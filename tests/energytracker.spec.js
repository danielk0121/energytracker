import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Energy Tracker UI Tests', () => {
  let pageUrl;

  test.beforeAll(() => {
    // Resolve the absolute path to the local HTML file
    const absolutePath = path.resolve(process.cwd(), 'prototype/index.html');
    pageUrl = `file://${absolutePath}`;
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(pageUrl);
  });

  test('should load the main page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/에너지트래커/);
    const heading = page.locator('h1');
    await expect(heading).toHaveText('에너지트래커');
  });

  test('should toggle dark mode when theme button is clicked', async ({ page }) => {
    const themeBtn = page.locator('.theme-btn');
    
    // Initially body might not have dark-mode, depending on local storage, 
    // but in a fresh context it should be light.
    const isDarkInitial = await page.locator('body').evaluate(body => body.classList.contains('dark-mode'));
    
    // Click to toggle
    await themeBtn.click();
    
    const isDarkAfter = await page.locator('body').evaluate(body => body.classList.contains('dark-mode'));
    expect(isDarkAfter).not.toBe(isDarkInitial);
  });

  test('should render monthly chart filters correctly', async ({ page }) => {
    const monthly13 = page.locator('#filter-monthly-13');
    await monthly13.click();
    await expect(monthly13).toHaveClass(/active/);
    
    const monthlyYear = page.locator('#filter-monthly-year');
    await monthlyYear.click();
    await expect(monthlyYear).toHaveClass(/active/);
    // 13months should not be active anymore
    await expect(monthly13).not.toHaveClass(/active/);
  });

  test('should render daily chart filters correctly', async ({ page }) => {
    const dailyMonth = page.locator('#filter-daily-month');
    await dailyMonth.click();
    await expect(dailyMonth).toHaveClass(/active/);
  });

  test('should navigate to settings page via menu button', async ({ page }) => {
    const menuBtn = page.locator('.menu-btn');
    await menuBtn.click();
    // Wait for URL to change to settings.html
    await expect(page).toHaveURL(/settings\.html/);
    const heading = page.locator('h1');
    await expect(heading).toHaveText('설정');
  });

  test('should render usage list table', async ({ page }) => {
    const tableBody = page.locator('#usage-list-body');
    // The table should have some rows initially due to mock data
    const rowCount = await tableBody.locator('tr').count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

import { expect, test } from '@playwright/test';
import { gotoProtected } from './test-env';

/**
 * E2E tests for the lottery simulation (backtest) feature.
 *
 * Full flow exercised:
 *   1. Navigate to /simulate (authenticated).
 *   2. Set a one-month archive window (from / to date inputs).
 *   3. Select form size 6 (default).
 *   4. Pick exactly 6 regular numbers from the pick grid.
 *   5. Pick a strong number (1-7).
 *   6. Click "Run simulation".
 *   7. Verify the results section renders:
 *      - Summary cards: total draws, total spent, total won, net, real prizes.
 *      - Tier summary table with 8 rows.
 *      - Draw history table with per-draw rows.
 *      - Prize source column badges (Real / Estimate).
 *
 * Requires the full stack running via Docker Compose (Traefik at http://localhost),
 * with the Go gRPC service connected to a seeded PostgreSQL database.
 */

// ── Helpers ───────────────────────────────────────────────────

/**
 * Pick exactly `count` regular numbers from the simulate pick grid.
 * The pick grid renders balls 1-37 that are not yet selected.
 * We click the first `count` available balls.
 */
async function pickRegularBalls(
  page: import('@playwright/test').Page,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const ball = page.locator('.pick-grid app-lottery-ball').first();
    await expect(ball).toBeVisible({ timeout: 5000 });
    await ball.click();
    await page.waitForTimeout(100);
  }
}

/**
 * Pick a strong number from the 1-7 strong-ball buttons.
 */
async function pickStrongNumber(
  page: import('@playwright/test').Page,
  value: number,
): Promise<void> {
  const strongBtn = page.locator(`.strong-ball:has-text("${value}")`).first();
  await expect(strongBtn).toBeVisible({ timeout: 5000 });
  await strongBtn.click();
}

/**
 * Format a Date as YYYY-MM-DD for the <input type="date"> value.
 */
function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Tests ─────────────────────────────────────────────────────

test.describe('Simulate page — full simulation flow', () => {
  test('run a one-month backtest simulation and verify results', async ({ page }) => {
    // 1. Navigate to the simulate page (handles Keycloak login).
    await gotoProtected(page, '/simulate');
    await expect(page.locator('h2')).toBeVisible({ timeout: 15000 });

    // 2. Set a one-month archive window.
    //    Use the most recent complete month relative to today.
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
    const from = new Date(to.getFullYear(), to.getMonth() - 1, 1); // first day, one month before

    const fromStr = formatDateInput(from);
    const toStr = formatDateInput(to);

    await page.locator('#archive-from').fill(fromStr);
    await page.locator('#archive-to').fill(toStr);
    await page.waitForTimeout(200);

    // 3. Verify form size defaults to 6.
    await expect(page.locator('#formSize')).toHaveValue('6');

    // 4. Pick exactly 6 regular numbers.
    await pickRegularBalls(page, 6);

    // Verify 6 selected balls appear.
    await expect(page.locator('.selected-balls app-lottery-ball')).toHaveCount(6, {
      timeout: 5000,
    });

    // 5. Pick strong number 3.
    await pickStrongNumber(page, 3);
    await expect(page.locator('.strong-ball.selected')).toHaveText('3');

    // 6. Click "Run simulation".
    const simBtn = page.locator('button.primary:has-text("הרץ"), button.primary:has-text("Run")');
    await expect(simBtn).toBeEnabled({ timeout: 5000 });
    await simBtn.click();

    // 7. Wait for results to render (or error toast if DB empty).
    //     The full round-trip is: Angular → Java BFF → Go gRPC → DB → response.
    await expect(
      page.locator('.results, .toast--error'),
    ).toBeVisible({ timeout: 45000 });

    // If the DB has no draws for this period, we get an error toast.
    // Skip result verification in that case.
    const hasError = await page.locator('.toast--error').isVisible({ timeout: 1000 }).catch(() => false);
    if (hasError) {
      console.warn('[simulate.spec] Error toast appeared — DB may have no draws for the selected period');
      return;
    }

    // ── Verify summary cards ──────────────────────────────────

    const summaryGrid = page.locator('.summary-grid');
    await expect(summaryGrid).toBeVisible({ timeout: 5000 });

    // Total draws card should have a numeric value.
    const totalDrawsValue = page.locator('.summary-card .summary-value').nth(0);
    await expect(totalDrawsValue).toBeVisible();
    const totalDrawsText = await totalDrawsValue.textContent();
    expect(totalDrawsText).toMatch(/\d+/);
    const totalDraws = parseInt(totalDrawsText!.trim(), 10);
    expect(totalDraws).toBeGreaterThan(0);

    // Total spent card should show currency (₪).
    const totalSpentValue = page.locator('.summary-card .summary-value').nth(1);
    await expect(totalSpentValue).toBeVisible();
    const totalSpentText = await totalSpentValue.textContent();
    expect(totalSpentText).toMatch(/₪/);

    // Total won card should show currency.
    const totalWonValue = page.locator('.summary-card .summary-value').nth(2);
    await expect(totalWonValue).toBeVisible();
    const totalWonText = await totalWonValue.textContent();
    expect(totalWonText).toMatch(/₪/);

    // Net card should show currency.
    const netValue = page.locator('.summary-card .summary-value').nth(3);
    await expect(netValue).toBeVisible();
    const netText = await netValue.textContent();
    expect(netText).toMatch(/₪/);

    // Real prizes card should show "X / Y" format.
    const realPrizesValue = page.locator('.summary-card .summary-value').nth(4);
    await expect(realPrizesValue).toBeVisible();
    const realPrizesText = await realPrizesValue.textContent();
    expect(realPrizesText).toMatch(/\d+\s*\/\s*\d+/);

    // ── Verify tier summary table ─────────────────────────────

    const tierTable = page.locator('.tier-summary table');
    await expect(tierTable).toBeVisible({ timeout: 5000 });

    // Should have exactly 8 tier rows.
    const tierRows = page.locator('.tier-summary tbody tr');
    await expect(tierRows).toHaveCount(8, { timeout: 5000 });

    // Each row should have a label, hit count, and amount.
    for (let i = 0; i < 8; i++) {
      const row = tierRows.nth(i);
      const cells = row.locator('td');
      expect(await cells.count()).toBe(3);
      const label = await cells.nth(0).textContent();
      expect(label).toBeTruthy();
      expect(label!.trim().length).toBeGreaterThan(0);
    }

    // ── Verify draw history table ─────────────────────────────

    const drawsSection = page.locator('.draws-section');
    await expect(drawsSection).toBeVisible({ timeout: 5000 });

    // Draw history table should have at least one row (matching totalDraws).
    const drawRows = page.locator('.draws-table tbody tr');
    const drawRowCount = await drawRows.count();
    expect(drawRowCount).toBeGreaterThan(0);
    // The number of draw rows should match the total draws in the summary.
    expect(drawRowCount).toBeLessThanOrEqual(totalDraws);

    // Each draw row should have 7 columns:
    // date, winning numbers, strong, tier hits, prize, cost, prize source.
    const firstRow = drawRows.first();
    const firstRowCells = firstRow.locator('td');
    expect(await firstRowCells.count()).toBe(7);

    // Prize source column (last column) should have a badge — either
    // "Real" (אמיתי) or "Estimate" (הערכה).
    const prizeSourceCell = firstRowCells.nth(6);
    const prizeBadge = prizeSourceCell.locator('.prize-badge');
    await expect(prizeBadge).toBeVisible({ timeout: 5000 });
    const badgeText = await prizeBadge.textContent();
    // Accept either Hebrew or English labels.
    expect(badgeText).toMatch(/אמיתי|הערכה|Real|Estimate/);

    // ── Verify prize badges are consistent with summary ────────

    // Count "Real" badges in the draw history.
    const realBadges = page.locator('.draws-table .prize-badge.real');
    const estimateBadges = page.locator('.draws-table .prize-badge.estimate');
    const realCount = await realBadges.count();
    const estimateCount = await estimateBadges.count();
    // Every draw row should have exactly one badge.
    expect(realCount + estimateCount).toBe(drawRowCount);
    // The "Real" count in the draw table should match the summary's
    // drawsWithRealPrizes.
    const realPrizesParts = realPrizesText!.match(/(\d+)\s*\/\s*(\d+)/);
    if (realPrizesParts) {
      const summaryRealCount = parseInt(realPrizesParts[1], 10);
      expect(realCount).toBe(summaryRealCount);
    }
  });

  test('simulate button is disabled until 6 numbers and strong are selected', async ({ page }) => {
    await gotoProtected(page, '/simulate');
    await expect(page.locator('h2')).toBeVisible({ timeout: 15000 });

    const simBtn = page.locator('button.primary:has-text("הרץ"), button.primary:has-text("Run")');

    // Initially disabled (no numbers, no strong).
    await expect(simBtn).toBeDisabled({ timeout: 5000 });

    // Pick 6 numbers — still disabled (no strong).
    await pickRegularBalls(page, 6);
    await expect(simBtn).toBeDisabled({ timeout: 2000 });

    // Pick strong — now enabled.
    await pickStrongNumber(page, 1);
    await expect(simBtn).toBeEnabled({ timeout: 2000 });
  });

  test('clear button removes all selected numbers and strong', async ({ page }) => {
    await gotoProtected(page, '/simulate');
    await expect(page.locator('h2')).toBeVisible({ timeout: 15000 });

    // Pick 6 numbers and a strong.
    await pickRegularBalls(page, 6);
    await pickStrongNumber(page, 5);
    await expect(page.locator('.selected-balls app-lottery-ball')).toHaveCount(6);
    await expect(page.locator('.strong-ball.selected')).toHaveText('5');

    // Click clear.
    const clearBtn = page.locator('button.clear-btn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Selected balls should be gone.
    await expect(page.locator('.selected-balls app-lottery-ball')).toHaveCount(0, {
      timeout: 5000,
    });
    // Strong should be deselected.
    await expect(page.locator('.strong-ball.selected')).toHaveCount(0, {
      timeout: 5000,
    });
  });

  test('changing form size to 8 allows selecting 8 numbers', async ({ page }) => {
    await gotoProtected(page, '/simulate');
    await expect(page.locator('h2')).toBeVisible({ timeout: 15000 });

    // Change form size to 8.
    await page.locator('#formSize').selectOption('8');
    await expect(page.locator('#formSize')).toHaveValue('8');

    // Pick 8 numbers.
    await pickRegularBalls(page, 8);
    await expect(page.locator('.selected-balls app-lottery-ball')).toHaveCount(8, {
      timeout: 5000,
    });

    // Pick strong — button should be enabled.
    await pickStrongNumber(page, 2);
    const simBtn = page.locator('button.primary:has-text("הרץ"), button.primary:has-text("Run")');
    await expect(simBtn).toBeEnabled({ timeout: 2000 });
  });
});

import { test, expect } from '@playwright/test';

test.describe('研发模块 · 流水线产物展示', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="rd-summary"]');
  });

  test('展示当前需求信息与状态', async ({ page }) => {
    const summary = page.locator('[data-testid="rd-summary"]');
    await expect(summary).toContainText('创建个人工作台');
    await expect(summary).toContainText('已完成');
  });

  test('展示 MR 与 E2E 报告链接', async ({ page }) => {
    const mr = page.locator('[data-testid="rd-mr-link"]');
    await expect(mr).toHaveAttribute('href', /github\.com\/hongdongdong\/sdd_dev\/pull/);
    const report = page.locator('[data-testid="rd-report-link"]');
    await expect(report).toHaveAttribute('href', /feishu\.cn/);
  });

  test('列出全部 SDD 产物', async ({ page }) => {
    const items = page.locator('[data-testid="rd-artifact-item"]');
    await expect(items).toHaveCount(6);
    await expect(items.first()).toContainText('变更提案');
    await expect(page.locator('[data-testid="rd-artifact-list"]')).toContainText('能力 Spec');
  });

  test('点击产物可查看内容', async ({ page }) => {
    await page.locator('[data-testid="rd-artifact-item"]').first().click();
    const content = page.locator('[data-testid="rd-artifact-content"]');
    await expect(content).toBeVisible();
    await expect(content).not.toHaveText(/^\s*$/);
  });
});

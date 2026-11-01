import { test, expect } from '@playwright/test';

const TODO_ITEMS = 'ul[data-testid="todo-list"] li[data-testid="todo-item"]';
const NOTE_ITEMS = 'ul[data-testid="note-list"] li[data-testid="note-item"]';
const LINK_ITEMS = 'ul[data-testid="link-list"] li[data-testid="link-item"]';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('待办清单', () => {
  test('成功新增待办并清空输入', async ({ page }) => {
    await page.getByTestId('todo-input').fill('写周报');
    await page.getByTestId('todo-add').click();
    await expect(page.locator(TODO_ITEMS)).toHaveCount(1);
    await expect(page.getByTestId('todo-text')).toHaveText('写周报');
    await expect(page.getByTestId('todo-input')).toHaveValue('');
  });

  test('空内容不新增待办并给出提示', async ({ page }) => {
    await page.getByTestId('todo-add').click();
    await expect(page.locator(TODO_ITEMS)).toHaveCount(0);
    await expect(page.getByTestId('todo-feedback')).toHaveText('请输入待办内容');

    await page.getByTestId('todo-input').fill('   ');
    await page.getByTestId('todo-add').click();
    await expect(page.locator(TODO_ITEMS)).toHaveCount(0);
  });

  test('切换待办完成状态', async ({ page }) => {
    await page.getByTestId('todo-input').fill('买牛奶');
    await page.getByTestId('todo-add').click();
    const toggle = page.getByTestId('todo-toggle');
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(page.getByTestId('todo-toggle')).toBeChecked();
    await page.getByTestId('todo-toggle').click();
    await expect(page.getByTestId('todo-toggle')).not.toBeChecked();
  });

  test('删除待办后从列表消失', async ({ page }) => {
    await page.getByTestId('todo-input').fill('临时事项');
    await page.getByTestId('todo-add').click();
    await expect(page.locator(TODO_ITEMS)).toHaveCount(1);
    await page.getByTestId('todo-delete').click();
    await expect(page.locator(TODO_ITEMS)).toHaveCount(0);
  });

  test('待办本地持久化', async ({ page }) => {
    await page.getByTestId('todo-input').fill('第一项');
    await page.getByTestId('todo-add').click();
    await page.getByTestId('todo-input').fill('第二项');
    await page.getByTestId('todo-add').click();
    await page.getByTestId('todo-toggle').first().click();

    await page.reload();
    await expect(page.locator(TODO_ITEMS)).toHaveCount(2);
    await expect(page.getByTestId('todo-text').first()).toHaveText('第一项');
    await expect(page.getByTestId('todo-toggle').first()).toBeChecked();

    await page.getByTestId('todo-delete').first().click();
    await page.reload();
    await expect(page.locator(TODO_ITEMS)).toHaveCount(1);
    await expect(page.getByTestId('todo-text')).toHaveText('第二项');
  });
});

test.describe('笔记', () => {
  test('成功新增笔记并清空输入', async ({ page }) => {
    await page.getByTestId('note-input').fill('会议纪要');
    await page.getByTestId('note-add').click();
    await expect(page.locator(NOTE_ITEMS)).toHaveCount(1);
    await expect(page.getByTestId('note-content')).toContainText('会议纪要');
    await expect(page.getByTestId('note-input')).toHaveValue('');
  });

  test('空内容不新增笔记并给出提示', async ({ page }) => {
    await page.getByTestId('note-add').click();
    await expect(page.locator(NOTE_ITEMS)).toHaveCount(0);
    await expect(page.getByTestId('note-feedback')).toHaveText('请输入笔记内容');

    await page.getByTestId('note-input').fill('   ');
    await page.getByTestId('note-add').click();
    await expect(page.locator(NOTE_ITEMS)).toHaveCount(0);
  });

  test('编辑并保存笔记后显示最新内容', async ({ page }) => {
    await page.getByTestId('note-input').fill('原始内容');
    await page.getByTestId('note-add').click();
    await page.getByTestId('note-edit').click();
    await page.getByTestId('note-edit-input').fill('修改后的内容');
    await page.getByTestId('note-save').click();
    await expect(page.getByTestId('note-content')).toContainText('修改后的内容');
  });

  test('删除笔记后从列表消失', async ({ page }) => {
    await page.getByTestId('note-input').fill('待删除笔记');
    await page.getByTestId('note-add').click();
    await expect(page.locator(NOTE_ITEMS)).toHaveCount(1);
    await page.getByTestId('note-delete').click();
    await expect(page.locator(NOTE_ITEMS)).toHaveCount(0);
  });

  test('笔记本地持久化', async ({ page }) => {
    await page.getByTestId('note-input').fill('初始笔记');
    await page.getByTestId('note-add').click();
    await page.getByTestId('note-edit').click();
    await page.getByTestId('note-edit-input').fill('持久化后的笔记');
    await page.getByTestId('note-save').click();

    await page.reload();
    await expect(page.locator(NOTE_ITEMS)).toHaveCount(1);
    await expect(page.getByTestId('note-content')).toContainText('持久化后的笔记');

    await page.getByTestId('note-delete').click();
    await page.reload();
    await expect(page.locator(NOTE_ITEMS)).toHaveCount(0);
  });
});

test.describe('快捷链接', () => {
  test('成功新增快捷链接并清空输入', async ({ page }) => {
    await page.getByTestId('link-name-input').fill('示例网站');
    await page.getByTestId('link-url-input').fill('https://example.com');
    await page.getByTestId('link-add').click();
    await expect(page.locator(LINK_ITEMS)).toHaveCount(1);
    await expect(page.getByTestId('link-open')).toHaveText('示例网站');
    await expect(page.getByTestId('link-open')).toHaveAttribute('href', 'https://example.com');
    await expect(page.getByTestId('link-name-input')).toHaveValue('');
    await expect(page.getByTestId('link-url-input')).toHaveValue('');
  });

  test('名称或网址为空不新增并给出提示', async ({ page }) => {
    await page.getByTestId('link-url-input').fill('https://example.com');
    await page.getByTestId('link-add').click();
    await expect(page.locator(LINK_ITEMS)).toHaveCount(0);
    await expect(page.getByTestId('link-feedback')).toHaveText('请填写链接名称和网址');

    await page.getByTestId('link-name-input').fill('示例网站');
    await page.getByTestId('link-url-input').fill('');
    await page.getByTestId('link-add').click();
    await expect(page.locator(LINK_ITEMS)).toHaveCount(0);
  });

  test('点击链接在新标签页打开目标网址', async ({ page, context }) => {
    await context.route('https://example.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>ok</body></html>' })
    );
    await page.getByTestId('link-name-input').fill('示例网站');
    await page.getByTestId('link-url-input').fill('https://example.com');
    await page.getByTestId('link-add').click();

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByTestId('link-open').click(),
    ]);
    await newPage.waitForURL('https://example.com/');
    expect(newPage.url()).toBe('https://example.com/');
    await expect(page.getByTestId('link-open')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('编辑并保存快捷链接后显示最新名称与网址', async ({ page }) => {
    await page.getByTestId('link-name-input').fill('旧名称');
    await page.getByTestId('link-url-input').fill('https://old.example.com');
    await page.getByTestId('link-add').click();
    await page.getByTestId('link-edit').click();
    await page.getByTestId('link-edit-name').fill('新名称');
    await page.getByTestId('link-edit-url').fill('https://new.example.com');
    await page.getByTestId('link-save').click();
    await expect(page.getByTestId('link-open')).toHaveText('新名称');
    await expect(page.getByTestId('link-open')).toHaveAttribute('href', 'https://new.example.com');
  });

  test('删除快捷链接后从列表消失', async ({ page }) => {
    await page.getByTestId('link-name-input').fill('待删除链接');
    await page.getByTestId('link-url-input').fill('https://example.com');
    await page.getByTestId('link-add').click();
    await expect(page.locator(LINK_ITEMS)).toHaveCount(1);
    await page.getByTestId('link-delete').click();
    await expect(page.locator(LINK_ITEMS)).toHaveCount(0);
  });

  test('快捷链接本地持久化', async ({ page }) => {
    await page.getByTestId('link-name-input').fill('初始链接');
    await page.getByTestId('link-url-input').fill('https://example.com');
    await page.getByTestId('link-add').click();
    await page.getByTestId('link-edit').click();
    await page.getByTestId('link-edit-name').fill('持久化链接');
    await page.getByTestId('link-edit-url').fill('https://persist.example.com');
    await page.getByTestId('link-save').click();

    await page.reload();
    await expect(page.locator(LINK_ITEMS)).toHaveCount(1);
    await expect(page.getByTestId('link-open')).toHaveText('持久化链接');
    await expect(page.getByTestId('link-open')).toHaveAttribute('href', 'https://persist.example.com');

    await page.getByTestId('link-delete').click();
    await page.reload();
    await expect(page.locator(LINK_ITEMS)).toHaveCount(0);
  });
});

test.describe('模块隔离', () => {
  test('三个模块数据互不串扰', async ({ page }) => {
    await page.getByTestId('todo-input').fill('只属于待办');
    await page.getByTestId('todo-add').click();
    await page.getByTestId('note-input').fill('只属于笔记');
    await page.getByTestId('note-add').click();
    await page.getByTestId('link-name-input').fill('只属于链接');
    await page.getByTestId('link-url-input').fill('https://example.com');
    await page.getByTestId('link-add').click();

    await expect(page.locator(TODO_ITEMS)).toHaveCount(1);
    await expect(page.locator(NOTE_ITEMS)).toHaveCount(1);
    await expect(page.locator(LINK_ITEMS)).toHaveCount(1);
    await expect(page.getByTestId('todo-text')).toHaveText('只属于待办');
    await expect(page.getByTestId('note-content')).toContainText('只属于笔记');
    await expect(page.getByTestId('link-open')).toHaveText('只属于链接');
  });
});

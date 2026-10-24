import { test, expect } from '@playwright/test'

const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

test('空多图层结果可用按钮或 Delete 删除，有图层的分组仍受保护', async ({ page }) => {
  await page.goto('/')
  const group = (id: string, x: number) => ({ id, type: 'card', position: { x, y: 210 }, style: { width: 210, height: 210 }, deletable: false,
    data: { kind: 'group', label: '多图层 · 原图坐标透明图层', layerStack: true, layerLayoutVersion: 2 } })
  const project = { format: 'visproj', schemaVersion: 1, name: '空图层清理', viewport: { x: 0, y: 0, zoom: 1 }, edges: [], nodes: [
    group('empty-button', 120), group('empty-keyboard', 410), group('nonempty', 700),
    { id: 'layer', type: 'card', parentId: 'nonempty', position: { x: 0, y: 0 }, style: { width: 210, height: 210 }, data: { kind: 'image', src, label: '背景图层', stackLayer: true } },
  ] }
  await page.locator('input[accept=".visproj"]').setInputFiles({ name: 'empty-groups.visproj', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) })

  const deleteButton = page.locator('[data-id="empty-button"]').getByRole('button', { name: '删除空多图层结果' })
  await expect(deleteButton).toBeVisible()
  const lightBackground = await deleteButton.evaluate(element => getComputedStyle(element).backgroundColor)
  await page.getByRole('button', { name: '切换深色主题' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(deleteButton).toBeVisible()
  await expect.poll(() => deleteButton.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground)

  await expect(page.locator('[data-id="nonempty"]').getByRole('button', { name: '删除空多图层结果' })).toHaveCount(0)
  await deleteButton.click()
  await expect(page.locator('[data-id="empty-button"]')).toHaveCount(0)

  await page.locator('[data-id="empty-keyboard"] .layer-stack').click({ position: { x: 80, y: 80 } })
  await expect(page.locator('[data-id="empty-keyboard"] .layer-stack')).toHaveClass(/selected/)
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-id="empty-keyboard"]')).toHaveCount(0)
  await expect(page.locator('[data-id="nonempty"]')).toBeVisible()
  await expect(page.locator('[data-id="layer"]')).toBeVisible()
  await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
  await page.reload()
  await expect(page.locator('[data-id="empty-button"],[data-id="empty-keyboard"]')).toHaveCount(0)
  await expect(page.locator('[data-id="nonempty"]')).toBeVisible()
})

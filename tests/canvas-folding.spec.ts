import { test, expect } from '@playwright/test'

test('收拢卸载子节点，保留封面与任务更新，展开恢复图片', async ({ page }) => {
  let polls = 0
  await page.route('**/api/skills/images/tasks/fold-test', route => {
    polls++
    return route.fulfill({ json: { id: 'fold-test', status: polls > 1 ? 'complete' : 'running', message: '测试任务', images: [] } })
  })
  await page.goto('/')
  await expect(page.locator('.react-flow__pane')).toBeVisible()
  const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  const project = {
    format: 'visproj', schemaVersion: 1, name: '收拢测试', viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: 'group', type: 'card', position: { x: 150, y: 150 }, style: { width: 280, height: 330 }, data: { kind: 'group', label: '收纳卡片', collapsed: true, expandedSize: { width: 650, height: 450 } } },
      ...['a', 'b'].map((id, index) => ({
        id, type: 'card', parentId: 'group', position: { x: 20 + index * 280, y: 80 }, style: { width: 250, height: 250 },
        data: { kind: 'image', label: id, src, imageOutput: true, ...(index ? { imageJob: { id: 'fold-test', status: 'running', message: '测试任务' } } : {}) },
      })),
    ],
    edges: [{ id: 'ab', source: 'a', target: 'b' }],
  }
  await page.locator('input[accept=".visproj"]').setInputFiles({ name: 'fold.visproj', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) })
  const children = page.locator('.react-flow__node[data-id="a"], .react-flow__node[data-id="b"]')
  await expect(page.locator('.collection-footer')).toContainText('2 个节点')
  await expect(page.getByAltText('分组封面')).toBeVisible()
  await expect(children).toHaveCount(0)
  await expect(page.locator('.collection-status')).toHaveText('已完成', { timeout: 12000 })
  expect(polls).toBeGreaterThan(1)
  await page.getByRole('button', { name: '展开卡片组', exact: true }).click()
  await expect(children).toHaveCount(2)
  await expect(children.first().locator('.image-body img')).toHaveAttribute('src', src)
  await page.getByRole('button', { name: '收拢卡片组', exact: true }).click()
  await expect(children).toHaveCount(0)
  await expect(page.locator('.collection-footer')).toContainText('2 个节点')
})

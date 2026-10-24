import { test, expect } from '@playwright/test'

const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

test('图片快捷功能共用多图层预计进度，隐藏等待浮条并支持深色主题', async ({ page }) => {
  await page.route('**/api/skills/images/tasks/**', route => route.fulfill({ json: {
    id: route.request().url().split('/').at(-1), status: 'running', message: '测试处理中',
    createdAt: new Date(Date.now() - 44_000).toISOString(), images: [],
  } }))
  const started = new Date(Date.now() - 44_000).toISOString()
  const operations = [
    ['edit', '正在编辑图片'],
    ['redraw', '正在引用生成'],
    ['separate', '正在拆分图层'],
    ['background', '正在去背景'],
    ['erase', '正在消除'],
    ['expand', '正在扩图'],
    ['upscale', '正在变清晰'],
  ] as const
  await page.goto('/')
  const project = { format: 'visproj', schemaVersion: 1, name: '任务进度测试', viewport: { x: 0, y: 0, zoom: 1 }, edges: [], nodes: operations.map(([operation], index) => ({
    id: `progress-${index}`, type: 'card', position: { x: 110 + index % 4 * 270, y: 180 + Math.floor(index / 4) * 270 }, style: { width: 220, height: 220 },
    data: { kind: 'image', src, label: operation, canvasOperation: operation, imageJob: { id: `mock-${index}`, status: 'running', message: '测试处理中', createdAt: started } },
  })) }
  await page.locator('input[accept=".visproj"]').setInputFiles({ name: 'progress.visproj', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) })
  for (const [index, [, label]] of operations.entries()) {
    const node = page.locator(`[data-id="progress-${index}"]`)
    await expect(node.getByRole('progressbar')).toHaveAttribute('aria-label', /预计进度/)
    await expect(node.locator('.canvas-task-progress')).toContainText(label)
    await expect(node.locator('.canvas-task-progress')).toContainText('%')
    await expect(node.locator('.canvas-task-progress > strong')).toContainText('%')
    await expect(node.locator('.canvas-task-progress > .canvas-task-progress-label')).toHaveText(`${label}…`)
    await expect(node.locator('.canvas-task-progress-track,.canvas-task-progress-heading')).toHaveCount(0)
    await expect(node.getByRole('button', { name: '停止等待' })).toHaveCount(0)
    await expect(node.locator('.canvas-task-progress-footer')).toHaveCount(0)
    await expect(node.locator('.processing-dot-array')).toHaveCount(1)
    await expect(node.locator('.task-activity-track')).toHaveCount(0)
  }
  await expect(page.locator('[data-id="progress-0"] .canvas-task-progress > strong')).toHaveCSS('font-size', '21px')
  await expect(page.locator('[data-id="progress-0"] .canvas-task-progress > strong')).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(page.locator('[data-id="progress-0"] .task-preview-shade')).toHaveCSS('backdrop-filter', /blur\(10px\)/)
  await page.locator('[data-id="progress-0"]').evaluate(node => (node as HTMLElement).style.setProperty('--image-hover-scale', '1.8'))
  const statusScale = await page.locator('[data-id="progress-0"] .processing-status').evaluate(element => {
    const transform = getComputedStyle(element).transform
    return transform === 'none' ? 1 : new DOMMatrix(transform).a
  })
  expect(statusScale).toBe(1)
  await page.screenshot({ path: 'test-results/canvas-task-progress-light.png' })
  await page.evaluate(() => { localStorage.setItem('visual-workspace-theme', 'dark') })
  await page.reload()
  await expect(page.locator('[data-id="progress-0"] .canvas-task-progress')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: 'test-results/canvas-task-progress-dark.png' })
  await expect(page.locator('[data-id="progress-0"] .canvas-task-progress')).toBeVisible()
})

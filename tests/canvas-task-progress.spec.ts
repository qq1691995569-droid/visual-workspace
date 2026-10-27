import { test, expect } from '@playwright/test'

const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

test('图片快捷功能统一显示生成状态卡片并支持深色主题', async ({ page }) => {
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
  for (const [index, [operation, label]] of operations.entries()) {
    const node = page.locator(`[data-id="progress-${index}"]`)
    await expect(node.getByRole('progressbar')).toHaveCount(0)
    await expect(node.locator('.canvas-task-progress,.generation-status')).toHaveCount(0)
    await expect(node.locator('.processing-status .generation-progress')).toHaveText(/%$/)
    await expect(node.locator('.processing-status .generation-progress')).toHaveCSS('font-size', /26px|32px/)
    await expect(node.locator('.processing-dot-field')).toHaveCSS('mask-image', /radial-gradient/)
    await expect(node.locator('.processing-status .generation-primary')).toHaveText(operation === 'separate' ? label : '正在生成')
    await expect(node.locator('.processing-status .generation-eyebrow')).toHaveCount(0)
    await expect(node.locator('.processing-status .generation-primary')).toHaveCSS('font-size', /12px|15px|14px/)
    await expect(node.locator('.processing-status .generation-message')).toHaveCount(0)
    await expect(node.locator('.processing-status .task-timing')).toHaveCount(0)
    await expect(node.locator('.task-activity-track')).toHaveCount(0)
    await expect(node.getByRole('button', { name: '停止等待' })).toHaveCount(0)
    await expect(node.locator('.processing-dot-array')).toHaveCount(1)
    const radius=await node.locator('.clean-image').evaluate(el=>getComputedStyle(el).borderRadius)
    await expect(node.locator('.generation-overlay')).toHaveCSS('border-radius',radius)
    await expect(node.locator('.image-processing')).toHaveCSS('border-radius',radius)
  }
  await expect(page.locator('[data-id="progress-0"] .task-preview-shade')).toHaveCSS('backdrop-filter', 'none')
  await page.locator('[data-id="progress-0"]').evaluate(node => (node as HTMLElement).style.setProperty('--image-hover-scale', '1.8'))
  const statusScale = await page.locator('[data-id="progress-2"] .processing-status').evaluate(element => {
    const transform = getComputedStyle(element).transform
    return transform === 'none' ? 1 : new DOMMatrix(transform).a
  })
  expect(statusScale).toBe(1)
  await page.screenshot({ path: 'test-results/canvas-task-progress-light.png' })
  await page.evaluate(() => { localStorage.setItem('visual-workspace-theme', 'dark') })
  await page.reload()
  await expect(page.locator('[data-id="progress-2"] .processing-status .generation-primary')).toHaveText('正在拆分图层')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: 'test-results/canvas-task-progress-dark.png' })
  await expect(page.locator('[data-id="progress-2"] .processing-status .generation-primary')).toHaveText('正在拆分图层')
})

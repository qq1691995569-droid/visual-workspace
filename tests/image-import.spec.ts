import {test, expect} from '@playwright/test'

test('大图按显示尺寸加载预览，刷新和导出保留原始字节，拒绝其他格式', async ({page}) => {
  await page.goto('/')
  const original = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 5000; canvas.height = 2500
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#936'; ctx.fillRect(50, 50, 4000, 2000)
    return canvas.toDataURL('image/png')
  })
  await page.locator('input[type=file]').first().setInputFiles({
    name: '5k.png', mimeType: 'image/png', buffer: Buffer.from(original.split(',')[1], 'base64'),
  })
  const image = page.locator('.image-body img').first()
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight])).toEqual([512, 256])
  await expect(page.getByLabel('图片像素尺寸')).toContainText('原图 5000 × 2500 px')
  await expect(page.getByLabel('图片像素尺寸')).toContainText('预览 4096 × 2048 px')
  const labelBox = await page.getByLabel('图片像素尺寸').boundingBox()
  const imageBox = await image.boundingBox()
  expect(labelBox!.y).toBeGreaterThan(imageBox!.y + imageBox!.height)
  await page.screenshot({path:'artifacts/image-dimensions-preview.png'})
  await page.mouse.click(1100, 160)
  await expect(page.getByLabel('图片像素尺寸')).toHaveCount(0)
  await image.click()
  await expect(page.getByLabel('图片像素尺寸')).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', {name:'导出项目', exact:true}).click()
  const stream = await (await downloaded).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const project = JSON.parse(Buffer.concat(chunks).toString())
  expect(project.nodes[0].data.src).toBe(original)
  expect(project.nodes[0].data.previewSrc).not.toBe(original)
  // The preview's empty corner keeps the source alpha channel.
  expect(await image.evaluate((el: HTMLImageElement) => {
    const c = document.createElement('canvas'); c.width = c.height = 1
    const ctx = c.getContext('2d')!; ctx.drawImage(el, 0, 0)
    return ctx.getImageData(0, 0, 1, 1).data[3]
  })).toBe(0)
  await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
  await page.reload()
  await expect(image).toBeVisible()
  await image.dblclick()
  const imageDownload = page.waitForEvent('download')
  await page.getByRole('button', {name:'下载预览图片',exact:true}).click()
  const imageStream = await (await imageDownload).createReadStream()
  const imageChunks: Buffer[] = []
  for await (const chunk of imageStream!) imageChunks.push(Buffer.from(chunk))
  expect(Buffer.concat(imageChunks)).toEqual(Buffer.from(original.split(',')[1], 'base64'))
  await page.getByRole('button', {name:'关闭图片预览',exact:true}).click()
  await page.locator('input[type=file]').first().setInputFiles({name:'fake.jpg',mimeType:'image/jpeg',buffer:Buffer.from('GIF89a')})
  await expect(page.getByText(/目前仅支持 PNG、JPG 图片/)).toBeVisible()
  await expect(page.locator('.image-body img')).toHaveCount(1)
})

test('JPG长边限制与小图保持原尺寸', async ({page}) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const {prepareUploadedImage} = await import('/src/imageImport.ts')
    const create = async (width: number, height: number) => {
      const c = document.createElement('canvas'); c.width = width; c.height = height
      const blob = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b!), 'image/jpeg'))
      const data = await prepareUploadedImage(new File([blob], 'photo.jpg', {type:'image/jpeg'}))
      const image = new Image(); image.src = data.previewSrc || data.src; await image.decode()
      return {width:image.naturalWidth,height:image.naturalHeight,hasPreview:!!data.previewSrc}
    }
    return [await create(2500, 5000), await create(1200, 800)]
  })
  expect(result).toEqual([{width:2048,height:4096,hasPreview:true},{width:1200,height:800,hasPreview:false}])
})

test('选中过技能节点后导入图片不自动连接，已有连线保持不变', async ({page}) => {
  await page.goto('/')
  const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  const project = {format:'visproj',schemaVersion:1,name:'独立导入',viewport:{x:0,y:0,zoom:1},nodes:[
    {id:'base',type:'card',position:{x:100,y:100},data:{kind:'image',label:'底图',src}},
    {id:'tool',type:'card',position:{x:800,y:100},data:{kind:'tool',tool:'light',label:'光影优化'}},
  ],edges:[{id:'existing',source:'base',target:'tool'}]}
  await page.locator('input[accept=".visproj"]').setInputFiles({name:'independent.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  await page.locator('.react-flow__node[data-id="tool"]').click({position:{x:70,y:20}})
  await expect(page.locator('.node-edit-notice')).toBeVisible()
  const upload = page.locator('input[type=file]').first()
  await upload.setInputFiles({name:'独立图片.png',mimeType:'image/png',buffer:Buffer.from(src.split(',')[1],'base64')})
  await expect(page.locator('.image-body')).toHaveCount(2)
  await page.mouse.click(1250,90)
  await upload.setInputFiles({name:'空白处导入.png',mimeType:'image/png',buffer:Buffer.from(src.split(',')[1],'base64')})
  await expect(page.locator('.image-body')).toHaveCount(3)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button',{name:'导出项目',exact:true}).click()
  const stream = await (await downloaded).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const saved = JSON.parse(Buffer.concat(chunks).toString())
  expect(saved.nodes).toHaveLength(4)
  expect(saved.edges).toHaveLength(1)
  expect(saved.edges[0]).toMatchObject({id:'existing',source:'base',target:'tool'})
})

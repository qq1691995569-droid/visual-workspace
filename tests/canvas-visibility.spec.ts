import {test,expect} from '@playwright/test'

test('屏幕外图片卸载，移回后恢复，画布数据与导出保留全部节点和连线',async({page})=>{
  await page.goto('/')
  const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  const project={format:'visproj',schemaVersion:1,name:'可见区域测试',viewport:{x:0,y:0,zoom:1},
    nodes:['a','b'].map((id,i)=>({id,type:'card',position:{x:400+i*1400,y:180},style:{width:250,height:200},data:{kind:'image',label:id,src}})),
    edges:[{id:'link',source:'a',target:'b'}]}
  await page.locator('input[accept=".visproj"]').setInputFiles({name:'visible.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  await expect(page.locator('[data-id="a"] .image-body')).toBeVisible()
  await expect(page.locator('[data-id="b"] .image-body')).toHaveCount(0)
  await page.mouse.move(1100,450);await page.mouse.down({button:'middle'})
  await page.mouse.move(100,450,{steps:15});await page.mouse.up({button:'middle'})
  await expect(page.locator('[data-id="b"] .image-body')).toBeVisible()
  await expect(page.locator('[data-id="a"] .image-body')).toHaveCount(0)
  await page.mouse.move(100,450);await page.mouse.down({button:'middle'})
  await page.mouse.move(1100,450,{steps:15});await page.mouse.up({button:'middle'})
  await expect(page.locator('[data-id="a"] .image-body')).toBeVisible()
  const download=page.waitForEvent('download')
  await page.getByRole('button',{name:'导出项目',exact:true}).click()
  const stream=await (await download).createReadStream(),chunks:Buffer[]=[]
  for await(const chunk of stream!)chunks.push(Buffer.from(chunk))
  const result=JSON.parse(Buffer.concat(chunks).toString())
  expect(result.nodes).toHaveLength(2)
  expect(result.edges).toHaveLength(1)
  expect(result.nodes.every((n:{data:{src:string}})=>n.data.src===src)).toBe(true)
})

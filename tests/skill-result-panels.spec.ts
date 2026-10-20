import {test, expect} from '@playwright/test'

for (const tool of ['light', 'material', 'style', 'furniture']) {
  test(`${tool}: 统一面板保持显式模式，切换结果不会丢失技能入口`, async ({page}) => {
    await page.goto('/')
    const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
    const options = {model:'doubao-seedream-5-0-pro-260628',resolution:'2K',ratio:'auto',count:2}
    const project = {format:'visproj',schemaVersion:1,name:'技能结果切换',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[
      {id:'source',type:'card',position:{x:2200,y:100},data:{kind:'tool',tool,label:'来源技能'}},
      ...['first','second'].map((id,index)=>({id,type:'card',position:{x:400+index*280,y:150},style:{width:220,height:180},data:{kind:'image',label:`结果${index+1}`,src,skillResult:{jobId:'old',sourceNode:'source',review:{}},...(index===0?{iterationContext:{tool,prompt:'',referenceIds:[],options}}:{})}})),
    ]}
    await page.locator('input[accept=".visproj"]').setInputFiles({name:'panels.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
    const first = page.locator('.react-flow__node[data-id="first"] .image-body')
    const second = page.locator('.react-flow__node[data-id="second"] .image-body')
    await first.click()
    await page.getByRole('button',{name:'展开创作面板',exact:true}).click()
    await page.getByRole('button',{name:'沿用技能',exact:true}).click()
    await expect(page.locator('.refine-current')).toContainText('结果1')
    await page.getByRole('button',{name:'自由编辑',exact:true}).click()
    await expect(page.getByLabel('创作提示词')).toBeVisible()
    await second.click({modifiers:['Control']})
    await expect(page.locator('.reference-strip')).toContainText('结果2')
    await page.getByRole('button',{name:'收起创作面板',exact:true}).click()
    await first.click()
    await page.getByRole('button',{name:'展开创作面板',exact:true}).click()
    await expect(page.getByLabel('创作提示词')).toBeVisible()
    await expect(page.locator('.reference-strip')).toContainText('结果2')
    await page.getByRole('button',{name:'沿用技能',exact:true}).click()
    await expect(page.locator('.refine-current')).toContainText('结果1')
    await second.click()
    await expect(page.locator('.refine-current')).toContainText('结果2')
    await expect(page.locator('.refine-heading')).toHaveCount(1)
    await expect(page.getByLabel('图像创作面板')).toHaveCount(1)
    await expect(page.locator('.composer-version')).toContainText('V1')
  })
}

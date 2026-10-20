import test from 'node:test'
import assert from 'node:assert/strict'
import {extractionTargets,extractionPrompt,extractedAssets,assetPreviewPrompt,materialCategory} from '../server/asset-extraction.mjs'
import {cleanAsset} from '../server/canvas-assets.mjs'
const image='data:image/png;base64,AAAA'
const subject=(name,parts)=>({requestedName:name,name,overviewZh:name+'整体搭配',previewType:'furniture',parts:parts.map(partZh=>({partZh,promptZh:'暖灰色细密纹理，低光泽',confidence:'low',substrateZh:'未知',processZh:'未确认',evidenceZh:'部分遮挡'}))})
test('name-based extraction handles multiple objects without a selection and checks full coverage',()=>{
  const targets=extractionTargets('沙发、地板，沙发\n床')
  assert.deepEqual(targets,['沙发','地板','床'])
  assert.throws(()=>extractionTargets(''))
  assert.throws(()=>extractionTargets('a b c d e f g'))
  const prompt=extractionPrompt('material',targets)
  assert.match(prompt,/无需用户圈选/)
  assert.match(prompt,/缝线、锁边、收口并入主体/)
  assert.throws(()=>extractedAssets({schemaVersion:1,subjectObjects:[subject('沙发',['织物'])]},'material',image,targets),/地板、床/)
})
test('furniture generates white product detail while floor and wall generate spatial previews',()=>{
  const {candidates}=extractedAssets({schemaVersion:1,subjectObjects:[subject('沙发',['座面']),subject('地板',['木地板']),subject('墙面',['墙漆'])],warnings:['本色待核对']},'material',image,['沙发','地板','墙面'])
  assert.deepEqual(candidates.map(c=>c.previewType),['furniture','space','space'])
  assert.equal(candidates[0].prompt,'暖灰色细密纹理，低光泽')
  assert.equal(candidates[0].confidence,'low')
  assert.match(candidates[0].notes,/未知.*未确认/)
  assert.match(assetPreviewPrompt(candidates[0]),/白底近景特写/)
  assert.match(assetPreviewPrompt(candidates[1]),/空间应用图/)
  const saved=cleanAsset({...candidates[0],sourceImage:image,image,extractionKey:'a'.repeat(64)})
  assert.equal(saved.sourceImage,image);assert.equal(saved.sourceObject,'沙发');assert.equal(saved.reviewStatus,'pending');assert.equal(saved.extractionKey,'a'.repeat(64))
})
test('model extraction preserves object appearance separately from the material-only prompt',()=>{
  const input={schemaVersion:1,subjectObjects:[{...subject('茶几',[]),promptZh:'圆形木茶几，三条腿'}]}
  const asset=extractedAssets(input,'model',image,['茶几']).candidates[0]
  assert.match(asset.prompt,/三条腿/)
  assert.match(assetPreviewPrompt(asset),/完整展示其造型/)
})
test('integrated objects absorb finishing details, while distinct visible bed materials remain separate',()=>{
  const data={schemaVersion:1,subjectObjects:[subject('地毯',['毯面','锁边']),subject('床',['床头板','床单','枕头'])]}
  const {candidates}=extractedAssets(data,'material',image,['地毯','床'])
  assert.equal(candidates.filter(c=>c.sourceObject==='地毯').length,1)
  assert.equal(candidates.filter(c=>c.sourceObject==='床').length,3)
})
test('asset naming and category use the visible material, not an unknown internal substrate',()=>{
  const s=subject('沙发',['座面']);s.parts[0]={...s.parts[0],assetName:'米白圈绒 · 沙发面料',materialCategory:'fabric'}
  const result=extractedAssets({schemaVersion:1,subjectObjects:[s]},'material',image,['沙发']).candidates[0]
  assert.equal(result.name,'米白圈绒 · 沙发面料');assert.equal(result.materialCategory,'fabric')
  assert.equal(materialCategory({promptZh:'半透明低光泽表面',substrateZh:'木材'}),'other')
})

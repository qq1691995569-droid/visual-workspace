import test from 'node:test'
import assert from 'node:assert/strict'
import {assetCategory} from '../src/assetCategory.ts'
const asset={kind:'material',name:'沙发木框',prompt:'陶土粉色粗纺织物，细密经纬交织肌理',tags:[],image:'',notes:''}
test('旧资产根据表面提示词归类，不用家具名称猜测材质',()=>{
 assert.equal(assetCategory(asset),'织物 / 面料')
 assert.equal(assetCategory({...asset,prompt:'低光泽细腻表面'}),'其他材质')
 assert.equal(assetCategory({...asset,prompt:'木纹与织物拼接'}),'其他材质')
 assert.equal(assetCategory({...asset,materialCategory:'leather'}),'皮革')
 assert.equal(assetCategory({...asset,kind:'model'}),'模型 / 对象')
 assert.equal(assetCategory({...asset,kind:'person'}),'人物')
 assert.equal(assetCategory({...asset,prompt:'米白色灰泥墙漆'}),'涂料 / 灰泥')
})

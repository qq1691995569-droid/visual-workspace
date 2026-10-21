import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

test('tone bridge accepts only the current same-origin parent and returns original export blob', async () => {
  const calls = [], sent = [], button = {}
  const parent = {postMessage: data => sent.push(data)}
  let receive
  const blob = new Blob(['png'], {type:'image/png'})
  const context = {parent, location:{origin:'https://canvas.test',search:'?session=one'}, URLSearchParams, Blob, File,
    window:{addEventListener:(_, fn)=>{receive=fn}},
    document:{createElement:()=>button,querySelector:()=>({append(){}})},
    loadImage:async(key,file)=>calls.push([key,file.name]), busy:false, states:{target:{}},
    defs:[['strength','整体强度',0,100,70]], $:()=>({value:70}), setValues(){}, exportImage:async callback=>callback(blob), parameters:()=>({strength:70}), status(){}
  }
  vm.runInNewContext(readFileSync(new URL('../public/scene-tone/bridge.js',import.meta.url),'utf8'), context)
  const event = {origin:'https://canvas.test',source:parent,data:{session:'one',type:'tone:image',key:'target',blob,name:'source.png'}}
  await receive({...event,origin:'https://other.test'})
  await receive({...event,source:{}})
  await receive({...event,data:{...event.data,session:'old'}})
  assert.equal(calls.length,0)
  await receive(event)
  assert.deepEqual(calls,[['target','source.png']])
  await button.onclick()
  assert.equal(sent[0].type,'tone:ready')
  assert.equal(sent[1].type,'tone:result')
  assert.equal(sent[1].blob,blob)
  assert.equal(sent[1].session,'one')
  assert.equal(button.disabled,false)
})

test('preview waits for both inputs and restores the saved profile before opening comparison',async()=>{
  const nodes={closePreview:{},comparisonMode:{onchange(){}},dialogContent:{querySelector:()=>({append(){}})}}
  const sent=[]
  const states={},parent={postMessage:message=>sent.push(message)},profile={strength:62,cast:{strength:40}},calls=[]
  let receive
  const scope={parent,location:{origin:'https://canvas.test',search:'?session=one&preview=1'},URLSearchParams,Blob,File,
    window:{addEventListener:(_,fn)=>{receive=fn}},
    document:{documentElement:{classList:{add(){}}},createElement:()=>({}),querySelector:()=>({append(){}})},
    states,loadImage:async key=>{states[key]={}},defs:[['strength','',0,100,70]],
    setValues:values=>calls.push(values),render(){},showLargePreview:()=>calls.push('open'),$:id=>nodes[id],
    castCorrection:null,clarityCorrection:null,
  }
  vm.runInNewContext(readFileSync(new URL('../public/scene-tone/bridge.js',import.meta.url),'utf8'),scope)
  const event=key=>({origin:'https://canvas.test',source:parent,data:{session:'one',type:'tone:image',key,expectedReference:true,parameters:profile,blob:new Blob(['image'],{type:'image/png'})}})
  await receive(event('target'));assert.equal(calls.length,0)
  assert.equal(sent.some(m=>m.type==='tone:preview-ready'),false)
  await receive(event('reference'))
  assert.equal(calls[0].strength,62);assert.equal(calls[1],'open')
  assert.equal(scope.castCorrection.strength,40)
  assert.equal(nodes.comparisonMode.value,'reference')
  assert.equal(sent.filter(m=>m.type==='tone:preview-ready').length,1)
})

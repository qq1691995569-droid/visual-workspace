import test from 'node:test'
import assert from 'node:assert/strict'
import {INTERACTIVE_EDIT_MODEL,interactiveEditPrompt} from '../server/interactive-edit.mjs'

test('Seedream interactive edit keeps numbered boxes and user instruction in one prompt',()=>{
  assert.equal(INTERACTIVE_EDIT_MODEL,'doubao-seedream-5-0-pro-260628')
  const prompt=interactiveEditPrompt('把区域 1 的沙发改成蓝色，区域 2 保持不变',[[120,180,640,760],[700,120,920,360]])
  assert.match(prompt,/区域 1：图 1 <bbox>120 180 640 760<\/bbox>/)
  assert.match(prompt,/区域 2：图 1 <bbox>700 120 920 360<\/bbox>/)
  assert.match(prompt,/把区域 1 的沙发改成蓝色，区域 2 保持不变/)
})

test('a short instruction applies to every selected region without repeating region names',()=>{
  const prompt=interactiveEditPrompt('去掉',[[120,180,640,760],[700,120,920,360]])
  assert.match(prompt,/区域 1：图 1 <bbox>120 180 640 760<\/bbox>/)
  assert.match(prompt,/区域 2：图 1 <bbox>700 120 920 360<\/bbox>/)
  assert.match(prompt,/修改要求：\n去掉/)
  assert.match(prompt,/对以上所有框选区域执行同一要求/)
  assert.equal(prompt.match(/去掉/g)?.length,1)
})

test('different instructions stay tied to their own numbered regions',()=>{
  const prompt=interactiveEditPrompt('区域 2：去掉\n区域 3：改成蓝色',[[100,100,300,300],[350,100,550,300],[600,100,800,300]])
  assert.match(prompt,/区域 2：图 1 <bbox>350 100 550 300<\/bbox>/)
  assert.match(prompt,/区域 3：图 1 <bbox>600 100 800 300<\/bbox>/)
  assert.match(prompt,/没有修改要求的框选区域保持原样/)
  assert.match(prompt,/区域 2：去掉\n区域 3：改成蓝色/)
})

test('interactive edit rejects missing and invalid regions before a paid task can be queued',()=>{
  assert.throws(()=>interactiveEditPrompt('改色',[]),/框选/)
  assert.throws(()=>interactiveEditPrompt('改色',[[700,100,120,300]]),/坐标无效/)
  assert.throws(()=>interactiveEditPrompt('改色',[[0,0,1000,999]]),/坐标无效/)
})

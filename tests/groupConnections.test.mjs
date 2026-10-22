import {test} from 'node:test'
import assert from 'node:assert/strict'
import {groupConnection} from '../src/groupConnections.ts'
const node=(id,parentId,collapsed=false)=>({id,parentId,position:{x:0,y:0},data:{collapsed}})
const edge={id:'flow',source:'a',target:'b',sourceHandle:'output',targetHandle:'input'}
const project=(e,n)=>groupConnection(e,new Map(n.map(x=>[x.id,x])),new Set(),new Set(),new Set())
test('expanded group shows internal provenance without selection',()=>{const p=project(edge,[node('g'),node('a','g'),node('b','g')]);assert.equal(p.hidden,false);assert.equal(p.source,'a');assert.equal(p.targetHandle,'input')})
test('collapse hides only internal display and never rewrites original graph',()=>{const original=structuredClone(edge);const n=[node('g',undefined,true),node('a','g'),node('b','g')];assert.equal(project(edge,n).hidden,true);n[0].data.collapsed=false;assert.equal(project(edge,n).hidden,false);assert.deepEqual(edge,original)})
test('external links hide when collapsed and restore exact handles on expansion',()=>{const n=[node('g',undefined,true),node('a','g'),node('b')];const p=project(edge,n);assert.equal(p.source,'a');assert.equal(p.hidden,true);n[0].data.collapsed=false;const restored=project(edge,n);assert.equal(restored.source,'a');assert.equal(restored.sourceHandle,'output');assert.equal(restored.targetHandle,'input')})
test('group to group connections retain distinct original edges',()=>{const n=[node('g',undefined,true),node('h',undefined,true),node('a','g'),node('b','h')];const p=project(edge,n);assert.equal(p.source,'a');assert.equal(p.target,'b');assert.equal(p.id,'flow');assert.equal(p.hidden,true)})

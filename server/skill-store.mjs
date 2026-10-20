import { atomicJsonWriter } from './atomic-json.mjs'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const v1 = JSON.parse(await readFile(new URL('./skills/scene-style-v1.json', import.meta.url), 'utf8'))
export const defaultV2 = JSON.parse(await readFile(new URL('./skills/scene-style-v2.json', import.meta.url), 'utf8'))
const writeAtomic = atomicJsonWriter()
export function skillStore(directory) {
  const file = path.join(directory, 'skill-config.json')
  let chain = Promise.resolve()
  async function read() { try { return JSON.parse(await readFile(file, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error; return { activeVersion: 2, versions: [v1, defaultV2] } } }
  async function mutate(change) { const work = chain.then(async () => { const data = await read(); change(data); await mkdir(directory, { recursive: true }); await writeAtomic(file, data); return data }); chain = work.catch(() => {}); return work }
  return {
    read, async active() { const data = await read(); return data.versions.find(v => v.version === data.activeVersion) },
    publish(body) { return mutate(data => {
      if (!Array.isArray(body.rules) || !body.rules.length || body.rules.length > 100 || !body.rules.every(rule => typeof rule === 'string' && rule.trim() && rule.length < 10000)) throw Error('技能规则需要 1–100 条有效文本')
      const version = Math.max(...data.versions.map(v => v.version)) + 1
      data.versions.push({ ...defaultV2, version, rules: body.rules.map(r => r.trim()), createdAt: new Date().toISOString() }); data.activeVersion = version
    }) },
    activate(version) { return mutate(data => { if (!data.versions.some(v => v.version === version)) throw Error('技能版本不存在'); data.activeVersion = version }) },
  }
}


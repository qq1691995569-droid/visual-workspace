import { writeFile, rename, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// Antivirus/indexers can briefly hold a Windows file open. Keep replacement atomic,
// serialize writers for each destination, and retain the temp file if recovery fails.
export function atomicJsonWriter({ write = writeFile, replace = rename, ensure = mkdir, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const queues = new Map()
  return (file, value) => {
    const contents = JSON.stringify(value)
    const work = (queues.get(file) || Promise.resolve()).catch(() => {}).then(async () => {
      await ensure(path.dirname(file), { recursive: true })
      const temp = `${file}.${randomUUID()}.tmp`
      await write(temp, contents)
      for (let attempt = 0; ; attempt++) {
        try { await replace(temp, file); return }
        catch (cause) {
          if (!['EPERM', 'EACCES', 'EBUSY'].includes(cause.code) || attempt >= 6) {
            const error = new Error('本地任务记录保存失败，请稍后重试或检查文件占用；已保留恢复文件')
            error.code = 'LOCAL_SAVE_FAILED'; error.cause = cause
            throw error
          }
          await sleep(Math.min(50 * 2 ** attempt, 1000))
        }
      }
    })
    queues.set(file, work)
    void work.finally(() => { if (queues.get(file) === work) queues.delete(file) }).catch(() => {})
    return work
  }
}

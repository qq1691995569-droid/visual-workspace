// Coalesce pending snapshots while serializing writes; never let an older save win.
export function latestProjectWriter<T>(write:(value:T)=>Promise<unknown>, status:(state:'saving'|'saved'|'error')=>void, delayMs=0) {
  let pending:{value:T}|undefined, running:Promise<boolean>|undefined
  let timer:ReturnType<typeof setTimeout>|undefined
  async function drain() {
    while(pending) {
      const item=pending;pending=undefined
      try {await write(item.value)} catch {pending ||= item;status('error');return false}
    }
    status('saved');return true
  }
  function flush():Promise<boolean> {
    clearTimeout(timer);timer=undefined
    if(running)return running
    if(!pending)return Promise.resolve(true)
    status('saving')
    running=Promise.resolve().then(drain).then(ok=>{running=undefined;if(ok&&pending)void flush();return ok})
    return running
  }
  return {enqueue(value:T){pending={value};clearTimeout(timer);if(delayMs){status('saving');timer=setTimeout(()=>void flush(),delayMs)}else void flush()},flush,dirty:()=>!!pending||!!running}
}

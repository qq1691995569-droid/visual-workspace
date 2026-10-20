import { targetDimensions, type Generation } from './generation.ts'

export function composerPosition(wanted:{x:number;y:number}, bounds:{x:number;y:number;width:number;height:number}[], width:number, height:number) {
  let y=wanted.y
  for(let i=0;i<=bounds.length;i++) {
    const collisions=bounds.filter(b=>wanted.x<b.x+b.width+30 && wanted.x+width+30>b.x && y<b.y+b.height+30 && y+height+30>b.y)
    if(!collisions.length)break
    y=Math.max(...collisions.map(b=>b.y+b.height))+60
  }
  return {x:wanted.x,y}
}

// The first image slot also owns the task. There is no separate tool card.
export function composerBatch(id: string, requestId: string, mode: 'generate' | 'redraw', prompt: string, generation: Generation, position: {x:number;y:number}, input?: {id:string;src:string;original?:string}, referenceIds?: string[]) {
  const size=targetDimensions(generation), width=340, height=width*size.height/size.width
  const controller={ id, type:'card' as const, position, style:{width,height}, selected:false, data:{kind:'image' as const,label:'生成中 1',tool:mode,prompt,generation,imagePresentationVersion:1,composerRequest:{id:requestId,input,referenceIds},comparison:input ? {original:input.original || input.src,input:input.src}:undefined,imageJob:{requestId,status:'submitting',message:'正在连接 DREO 后台…'},pendingResult:{jobId:requestId,sourceNode:id,index:0,endpoint:'images' as const}} }
  const rest=Array.from({length:generation.count-1},(_,i)=>({id:`skill-${requestId}-${i+1}`,type:'card' as const,position:{x:position.x+(i+1)*380,y:position.y},style:{width,height},selected:false,data:{kind:'image' as const,label:`生成中 ${i+2}`,imagePresentationVersion:1,pendingResult:{jobId:requestId,sourceNode:id,index:i+1,endpoint:'images' as const}}}))
  return {controller,rest}
}

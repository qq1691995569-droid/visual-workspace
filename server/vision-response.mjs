function candidateJson(text){
 const value=text.trim().replace(/^\uFEFF/,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim()
 const candidates=[value]
 const start=value.indexOf('{'),end=value.lastIndexOf('}')
 if(start>=0&&end>start)candidates.push(value.slice(start,end+1))
 return candidates
}

export function parseVisionJson(content){
 if(typeof content!=='string'||!content.trim())throw Object.assign(Error('视觉分析未返回有效 JSON，请重试；本次未提交生图'),{code:'VISION_INVALID_JSON'})
 for(const candidate of candidateJson(content)){
  try{
   const parsed=JSON.parse(candidate)
   if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed
  }catch{}
 }
 throw Object.assign(Error('视觉分析未返回有效 JSON，请重试；本次未提交生图'),{code:'VISION_INVALID_JSON'})
}

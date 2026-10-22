export function imageToolError(diagnostic='',{action,signal}={}){
 const stage=action==='inspect'?'底图读取':action==='prepare'?'对象定位图处理':'本地图像处理'
 if(signal==='SIGTERM'||signal==='SIGKILL')return `${stage}超时，请缩小图片后重试`
 if(/DecompressionBomb|image too large|exceeds limit/.test(diagnostic))return `${stage}失败：图片超过 4000 万像素，请缩小尺寸后重试`
 if(/ModuleNotFoundError|ImportError/.test(diagnostic))return `${stage}失败：Python 图像依赖缺失，请检查运行环境`
 if(/UnidentifiedImageError|cannot identify image|broken data stream|truncated|Incorrect padding/.test(diagnostic))return `${stage}失败：图片数据无法解码或不完整，请重新导入原图`
 if(/MemoryError|bad allocation/.test(diagnostic))return `${stage}失败：可用内存不足，请缩小图片后重试`
 if(diagnostic.includes('Expansion alignment check failed'))return '扩图结果改变了原图位置或内容，已停止合成，避免重影与接缝。请调整扩图范围或更换模型后重试。'
 return `${stage}失败（${/\b(?:ValueError|KeyError|TypeError|OSError)\b/.exec(diagnostic)?.[0]||'处理异常'}），请检查图片和选区`
}

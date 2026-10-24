export const INTERACTIVE_EDIT_MODEL='doubao-seedream-5-0-pro-260628'

export function interactiveEditPrompt(prompt,boxes){
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>5000)throw Error('请填写不超过 5000 字的修改要求')
  if(!Array.isArray(boxes)||boxes.length<1||boxes.length>12)throw Error('请在图片中框选 1 至 12 个编辑区域')
  const locations=boxes.map((box,index)=>{
    if(!Array.isArray(box)||box.length!==4||box.some(value=>!Number.isInteger(value)||value<0||value>999)||box[0]>=box[2]||box[1]>=box[3])throw Error(`区域 ${index+1} 的框选坐标无效`)
    return `区域 ${index+1}：图 1 <bbox>${box.join(' ')}</bbox>`
  })
  return `仅编辑以下框选位置，区域编号与画布上的标记一致：\n${locations.join('\n')}\n修改要求：\n${prompt.trim()}\n逐个区域按对应要求编辑；没有修改要求的框选区域保持原样。若修改要求未提及任何区域编号，才对以上所有框选区域执行同一要求。保留未指定区域的构图、对象、文字和光影；不要画出边框、编号或坐标。`
}

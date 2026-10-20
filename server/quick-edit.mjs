export function expansionPlan(frame, supplement='') {
  if(!frame||!['x','y','width','height'].every(k=>Number.isFinite(frame[k]))||frame.x>0||frame.y>0||frame.width<1||frame.height<1||frame.width>4||frame.height>4||frame.x+frame.width<1||frame.y+frame.height<1||frame.width*frame.height<=1.001)throw Error('请向原图外拖动扩图边框，单边最长为原图的 4 倍')
  if(typeof supplement!=='string'||supplement.length>5000)throw Error('扩图说明过长')
  return {...frame}
}

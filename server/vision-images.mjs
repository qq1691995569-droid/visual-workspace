import {prepareReference} from './reference-image.mjs'

// Shared by all skill personas: compress analysis copies, never generation originals.
export const visionImageLimits = Object.freeze({max_edge:2048,max_pixels:2048*2048,max_bytes:2_000_000})
export async function prepareVisionImages(images) {
  const result=[]
  // Sequential decoding bounds memory when a request includes many references.
  const cache=new Map()
  for(const original of images){
    if(!cache.has(original))cache.set(original,(await prepareReference(original,visionImageLimits)).image)
    result.push(cache.get(original))
  }
  return result
}

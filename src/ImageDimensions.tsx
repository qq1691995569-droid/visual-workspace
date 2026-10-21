import {useEffect, useState} from 'react'

function parseDimensions(value?: string) {
  const match = value?.match(/^(\d+)\s*[×x]\s*(\d+)$/)
  return match && Number(match[1]) > 0 && Number(match[2]) > 0 ? `${match[1]} × ${match[2]}` : undefined
}

export function ImageDimensions({src, previewSrc, dimensions}: {src: string; previewSrc?: string; dimensions?: string}) {
  const known = parseDimensions(dimensions)
  const [loaded, setLoaded] = useState<{src: string; value: string}>()
  const [preview, setPreview] = useState<{src: string; value: string}>()
  useEffect(() => {
    let active = true
    const images: HTMLImageElement[] = []
    const measure = (url: string, done: (value: {src: string; value: string}) => void) => {
      const image = new Image()
      images.push(image)
      image.onload = () => { if (active) done({src: url, value: `${image.naturalWidth} × ${image.naturalHeight}`}) }
      image.src = url
    }
    if (!known) measure(src, setLoaded)
    if (previewSrc) measure(previewSrc, setPreview)
    return () => { active = false; images.forEach(image => { image.onload = null; image.removeAttribute('src') }) }
  }, [src, previewSrc, known])
  const value = known || (loaded?.src === src ? loaded.value : undefined)
  const [w, h] = (value || '').split(' × ').map(Number)
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a
  const divisor = w && h ? gcd(w, h) : 1
  const ratio = w && h ? `${w / divisor}:${h / divisor}` : ''
  return <div className="image-dimensions" aria-label="图片尺寸和比例" title={previewSrc && preview?.src === previewSrc ? `预览 ${preview.value} px` : undefined}>
    <span className="image-pixel-size">{value || '读取尺寸…'}{value && <small> px</small>}</span>
    {ratio && <span className="image-aspect-ratio">{ratio}</span>}
  </div>
}

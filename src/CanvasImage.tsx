import { useEffect, useState } from 'react'
import { useStore } from '@xyflow/react'
import { acquireCanvasPreview } from './canvasPreviewCache'

export function CanvasImage({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  // Subscribe to resolution tiers, not every pan/zoom step.
  const edge = useStore(state => {
    const pixels = Math.max(width, height) * state.transform[2] * window.devicePixelRatio
    return [256, 512, 1024, 2048, 4096].find(size => size >= pixels) || 4096
  })
  const [preview, setPreview] = useState<{ src: string; url: string }>()
  useEffect(() => {
    let cancelled = false
    let handle: ReturnType<typeof acquireCanvasPreview> | undefined
    const timer = setTimeout(() => {
      handle = acquireCanvasPreview(src, edge)
      void handle.promise.then(async url => {
        if (cancelled) return
        const image = new Image()
        try {
          image.src = url; await image.decode()
          if (!cancelled) setPreview({ src, url })
        } catch { /* Keep the already visible original on preview failure. */ }
        finally { image.removeAttribute('src') }
      })
    }, 160)
    return () => { cancelled = true; clearTimeout(timer); handle?.release() }
  }, [src, edge])
  return <img src={preview?.src === src ? preview.url : src} alt={alt} draggable={false} decoding="async" />
}

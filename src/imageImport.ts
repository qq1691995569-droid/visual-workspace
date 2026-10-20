export const MAX_CANVAS_IMAGE_EDGE = 4096

// Original bytes remain the source of truth for downloads, export and generation.
export async function prepareUploadedImage(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const png = bytes.length === 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!png && !jpeg) throw Error('目前仅支持 PNG、JPG 图片')
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(Error('图片读取失败'))
    reader.readAsDataURL(new Blob([file], { type: png ? 'image/png' : 'image/jpeg' }))
  })
  const image = new Image()
  image.src = src
  try {
    await image.decode()
    const width = image.naturalWidth, height = image.naturalHeight
    const scale = Math.min(1, MAX_CANVAS_IMAGE_EDGE / Math.max(width, height))
    let previewSrc: string | undefined
    if (scale < 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      try {
        const context = canvas.getContext('2d')
        if (!context) throw Error('无法创建图片预览')
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        // PNG preserves alpha; JPEG previews use a high-quality lossy encoding.
        previewSrc = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9)
      } finally {
        canvas.width = canvas.height = 0
      }
    }
    return { src, previewSrc, width, height }
  } finally {
    image.removeAttribute('src')
  }
}

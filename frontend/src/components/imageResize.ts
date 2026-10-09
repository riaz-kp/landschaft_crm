export interface CompressedImage {
  dataUrl: string
  /** Size after compression, in KB. */
  sizeKb: number
  /** The file as it came off the camera, in KB. */
  originalKb: number
  width: number
  height: number
}

/** Bytes held by a base64 data URL. */
function dataUrlKb(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4 / 1024)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Not an image'))
      img.onload = () => resolve(img)
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function draw(img: HTMLImageElement, longest: number, quality: number): { url: string; w: number; h: number } {
  const scale = Math.min(1, longest / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // JPEG has no transparency — paint white behind PNGs with see-through areas.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  return { url: canvas.toDataURL('image/jpeg', quality), w: canvas.width, h: canvas.height }
}

/**
 * Compresses a photo on the device before it is uploaded, so a foreman on a
 * site connection sends a few hundred KB instead of a 4–8 MB camera original.
 * The longest side is capped at `maxPx`, then JPEG quality steps down — and
 * the size with it — until the result is under `maxKb`.
 */
export async function compressImage(file: File, maxPx = 1600, maxKb = 300): Promise<CompressedImage> {
  const img = await loadImage(file)
  const originalKb = Math.round(file.size / 1024)
  let longest = maxPx
  let best = draw(img, longest, 0.82)
  for (let attempt = 0; attempt < 8 && dataUrlKb(best.url) > maxKb; attempt += 1) {
    const quality = Math.max(0.45, 0.82 - (attempt + 1) * 0.08)
    // Once quality is as low as it should go, shrink the picture instead.
    if (quality <= 0.5) longest = Math.round(longest * 0.8)
    best = draw(img, longest, quality)
  }
  return { dataUrl: best.url, sizeKb: dataUrlKb(best.url), originalKb, width: best.w, height: best.h }
}

/**
 * Shrinks an uploaded photo to a small square-ish thumbnail data URL. Profile
 * photos live in browser storage in the prototype, so a phone-camera original
 * (several MB) would exhaust the quota after a handful of uploads.
 */
export async function resizeImage(file: File, maxSize = 320): Promise<string> {
  return (await compressImage(file, maxSize, 60)).dataUrl
}

/** "4.2 MB" / "280 KB". */
export function formatKb(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

import juice from 'juice'

export async function solveWeChatImage() {
  const clipboardDiv = document.getElementById(`output`)
  const images = clipboardDiv.getElementsByTagName(`img`)

  const promises = []

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    const width = image.getAttribute(`width`)
    const height = image.getAttribute(`height`)
    image.removeAttribute(`width`)
    image.removeAttribute(`height`)
    image.style.width = width
    image.style.height = height

    // handle blob object url
    if (image.src.startsWith(`blob:`) || image.src.startsWith(`data:image/`)) {
      // src -> base64
      const canvas = document.createElement(`canvas`)
      const ctx = canvas.getContext(`2d`)
      const img = new Image()
      img.src = image.src

      // TODO use OffscreenCanvas
      const p = new Promise((resolve) => {
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          image.src = canvas.toDataURL(`image/webp`)
          resolve()
        }
      })
      promises.push(p)
    }
  }

  await Promise.all(promises)

  return
}

export function mergeCss(html) {
  return juice(html, {
    inlinePseudoElements: true,
    preserveImportant: true,
  })
}

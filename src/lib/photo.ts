/**
 * Turns a photo from the phone into a small square picture (320 × 320, centre-cropped) as a
 * data URL, so it's light to store and quick to show. WebP where the browser can make it,
 * otherwise JPEG.
 */
export async function squarePhoto(file: File, size = 320): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That photo couldn't be opened. Try another one."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("That photo couldn't be opened. Try another one.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    for (const quality of [0.82, 0.7, 0.55]) {
      let out = canvas.toDataURL("image/webp", quality);
      if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", quality);
      if (out.length <= 140_000) return out;
    }
    throw new Error("That photo is too detailed. Try another one.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

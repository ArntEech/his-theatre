/**
 * Pictures for News posts: the longest side shrunk to 1280 pixels, as WebP (or JPEG), small
 * enough to load quickly on mobile data (about 400 KB at most).
 */
export async function postImage(file: File, max = 1280): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a picture.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That picture couldn't be opened. Try another one."));
      i.src = url;
    });
    for (const side of [max, 1024, 800]) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("That picture couldn't be opened. Try another one.");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        let out = canvas.toDataURL("image/webp", quality);
        if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", quality);
        if (out.length <= 390_000) return out;
      }
    }
    throw new Error("That picture is too large. Try another one.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

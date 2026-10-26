import { COVER_SIZE, svgUrl, type CoverSettings } from "$lib/core/cover";
import type { ProjectFs } from "$lib/core/fs";
import { imageMime } from "$lib/core/images";

/** Bytes as base64, a piece at a time so a large picture does not overflow the call stack. */
function base64(data: Uint8Array): string {
  let text = "";
  for (let i = 0; i < data.length; i += 0x8000) text += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(text);
}

/** The cover's picture as a data: URL, read from the project; "" without one, or when it cannot be read. */
export async function coverPicture(fs: ProjectFs, cover: CoverSettings): Promise<string> {
  if (!cover.image) return "";
  try {
    return `data:${imageMime(cover.image)};base64,${base64(await fs.readBytes(cover.image))}`;
  } catch {
    return "";
  }
}

/**
 * Draws the SVG cover into a PNG, which every ebook reader shows; null when the
 * browser cannot, and the SVG is used instead. A `picture` (a data: URL) is drawn first,
 * filling the cover, and `svg` holds only the texts to lay over it.
 */
export async function coverPng(svg: string, picture = ""): Promise<Uint8Array | null> {
  try {
    const [width, height] = COVER_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    if (picture) {
      const photo = new Image();
      photo.src = picture;
      await photo.decode();
      // As the cover's frame crops it: filled, centred.
      const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight);
      const w = photo.naturalWidth * scale;
      const h = photo.naturalHeight * scale;
      context.drawImage(photo, (width - w) / 2, (height - h) / 2, w, h);
    }
    const image = new Image();
    image.src = svgUrl(svg);
    await image.decode();
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/**
 * Draws an image of a format Word or an ebook cannot hold (WebP, SVG, BMP…) into a PNG of
 * the same size; null when the browser cannot read it.
 */
export async function imageToPng(data: Uint8Array, mime: string): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth || 800;
    const height = image.naturalHeight || 600;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? { data: new Uint8Array(await blob.arrayBuffer()), width, height } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

import { COVER_SIZE, svgUrl } from "$lib/core/cover";

/**
 * Draws the SVG cover into a PNG, which every ebook reader shows; null when the
 * browser cannot, and the SVG is used instead.
 */
export async function coverPng(svg: string): Promise<Uint8Array | null> {
  try {
    const image = new Image();
    image.src = svgUrl(svg);
    await image.decode();
    const [width, height] = COVER_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
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

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

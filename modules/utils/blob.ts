/** Blob a base64, sin el prefijo data:. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

/** Blob a data URI, para chrome.downloads.download desde el service worker. */
export async function blobToDataUri(blob: Blob, mime: string): Promise<string> {
  return `data:${mime};base64,${await blobToBase64(blob)}`;
}

const BASE64_CHUNK_SIZE = 0x8000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + BASE64_CHUNK_SIZE),
    );
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function pipeThrough(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeShareFragment(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const compressed = await pipeThrough(json, new CompressionStream("gzip"));
  return toBase64Url(compressed);
}

export async function decodeShareFragment(fragment: string): Promise<unknown> {
  const compressed = fromBase64Url(fragment);
  const json = await pipeThrough(compressed, new DecompressionStream("gzip"));
  return JSON.parse(new TextDecoder().decode(json));
}

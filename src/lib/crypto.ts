export async function sha256hex(data: Uint8Array): Promise<string> {
  // SubtleCrypto.digest reads exactly the view's [byteOffset, byteLength) range,
  // so a subarray view hashes only its slice (not the whole backing buffer).
  const hash = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * AES-256-GCM encryption/decryption using the Web Crypto API.
 * All operations are performed locally - no data leaves the device.
 */

const IV_LENGTH = 12;

/**
 * Generate a random AES-256-GCM device key. Extractable so it can be
 * persisted to chrome.storage.local and survive service-worker restarts.
 */
export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/** Export an AES-GCM key to a JWK object (key must be extractable). */
export async function exportKeyToJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

/** Re-import an AES-GCM key from a JWK object. */
export async function importKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt plaintext with AES-256-GCM. Returns base64-encoded IV and ciphertext. */
export async function encrypt(
  key: CryptoKey,
  plaintext: string
): Promise<{ iv: string; ciphertext: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(new Uint8Array(encrypted)),
  };
}

/** Decrypt AES-256-GCM ciphertext. Inputs are base64-encoded. */
export async function decrypt(
  key: CryptoKey,
  iv: string,
  ciphertext: string
): Promise<string> {
  const decoder = new TextDecoder();
  const ivBytes = base64ToArrayBuffer(iv);
  const ciphertextBytes = base64ToArrayBuffer(ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer },
    key,
    ciphertextBytes.buffer as ArrayBuffer
  );

  return decoder.decode(decrypted);
}

// --- Base64 helpers ---

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

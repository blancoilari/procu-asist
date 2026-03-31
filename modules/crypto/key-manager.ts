/**
 * Manages the CryptoKey lifecycle for the current browser session.
 * The derived key lives only in memory and is lost when the
 * service worker restarts (MV3 behavior).
 */

import { deriveKey, encrypt, decrypt, generateSalt } from './aes-gcm';

const STORAGE_KEY_SALT = 'tl_master_salt';
const STORAGE_KEY_TEST = 'tl_pin_test';
const TEST_PLAINTEXT = 'procu-asist-pin-ok';

let currentKey: CryptoKey | null = null;

/** Check if the vault is currently unlocked */
export function isUnlocked(): boolean {
  return currentKey !== null;
}

/** Get the current in-memory CryptoKey (null if locked) */
export function getKey(): CryptoKey | null {
  return currentKey;
}

/** Clear the key from memory (lock) */
export function lock(): void {
  currentKey = null;
}

/**
 * First-time PIN setup: generates salt, derives key, stores encrypted test value.
 * Returns true on success.
 */
export async function setupPin(pin: string): Promise<boolean> {
  const salt = generateSalt();
  const key = await deriveKey(pin, salt);

  // Encrypt a known test value to validate PIN on future unlocks
  const testEncrypted = await encrypt(key, TEST_PLAINTEXT);

  await chrome.storage.local.set({
    [STORAGE_KEY_SALT]: Array.from(salt),
    [STORAGE_KEY_TEST]: testEncrypted,
  });

  currentKey = key;
  return true;
}

/**
 * Unlock with PIN: derives key and validates against stored test value.
 * Returns true if PIN is correct.
 */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEY_SALT,
    STORAGE_KEY_TEST,
  ]);

  if (!stored[STORAGE_KEY_SALT] || !stored[STORAGE_KEY_TEST]) {
    return false; // PIN not set up yet
  }

  const salt = new Uint8Array(stored[STORAGE_KEY_SALT] as number[]);
  const key = await deriveKey(pin, salt);

  try {
    const testValue = stored[STORAGE_KEY_TEST] as { iv: string; ciphertext: string };
    const decrypted = await decrypt(key, testValue.iv, testValue.ciphertext);

    if (decrypted === TEST_PLAINTEXT) {
      currentKey = key;
      return true;
    }
  } catch {
    // Decryption failed = wrong PIN
  }

  return false;
}

/** Check if a master PIN has been configured */
export async function isPinSetup(): Promise<boolean> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_SALT]);
  return !!stored[STORAGE_KEY_SALT];
}

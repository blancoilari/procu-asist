/**
 * Manages the CryptoKey lifecycle.
 *
 * The derived key lives in memory and is lost when the MV3 service worker
 * restarts (~30s of inactivity). To keep auto-login working without
 * re-prompting for the PIN, the key is also persisted to chrome.storage.local
 * and lazily restored via {@link ensureKey} after a restart.
 *
 * Security note: persisting the key next to the encrypted credentials means
 * anyone with access to the unlocked device/profile could decrypt them. This
 * is a deliberate convenience-over-security choice. A manual sign-out
 * ({@link forgetPersistedKey}) removes the persisted key.
 */

import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
  exportKeyToJwk,
  importKeyFromJwk,
} from './aes-gcm';

const STORAGE_KEY_SALT = 'tl_master_salt';
const STORAGE_KEY_TEST = 'tl_pin_test';
const STORAGE_KEY_PERSISTED = 'tl_persisted_key';
const STORAGE_KEY_SETTINGS = 'tl_settings';
const TEST_PLAINTEXT = 'procu-asist-pin-ok';

let currentKey: CryptoKey | null = null;

/**
 * Read the `persistUnlock` setting directly (avoids a circular import on the
 * settings-store module). Defaults to `false` so the safe behavior wins when
 * the setting is absent.
 */
async function isPersistUnlockEnabled(): Promise<boolean> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  const settings = stored[STORAGE_KEY_SETTINGS] as
    | Record<string, unknown>
    | undefined;
  return settings?.persistUnlock === true;
}

/**
 * Resolve the vault key, restoring it from persistent storage if the service
 * worker was restarted and the user opted into persistent unlock. Returns
 * null if the vault was never unlocked or the persistence setting is off.
 */
export async function ensureKey(): Promise<CryptoKey | null> {
  if (currentKey) return currentKey;
  if (!(await isPersistUnlockEnabled())) return null;

  const stored = await chrome.storage.local.get(STORAGE_KEY_PERSISTED);
  const jwk = stored[STORAGE_KEY_PERSISTED] as JsonWebKey | undefined;
  if (!jwk) return null;

  try {
    currentKey = await importKeyFromJwk(jwk);
    return currentKey;
  } catch (err) {
    console.warn('[ProcuAsist] Could not restore persisted vault key:', err);
    return null;
  }
}

/**
 * Persist the key so it survives service-worker restarts — but only if the
 * user opted in via the `persistUnlock` setting. When the setting is off,
 * any pre-existing blob is removed so we don't leak the key on disk.
 */
async function persistKey(key: CryptoKey): Promise<void> {
  if (!(await isPersistUnlockEnabled())) {
    await chrome.storage.local.remove(STORAGE_KEY_PERSISTED);
    return;
  }
  try {
    const jwk = await exportKeyToJwk(key);
    await chrome.storage.local.set({ [STORAGE_KEY_PERSISTED]: jwk });
  } catch (err) {
    console.warn('[ProcuAsist] Could not persist vault key:', err);
  }
}

/**
 * Reconcile the persisted-key blob with the current `persistUnlock` setting.
 * Called after the user toggles the setting in the side panel.
 *  - Setting ON  + key in memory → write the blob.
 *  - Setting OFF                  → remove any existing blob (the in-memory
 *                                   key is preserved for this session).
 */
export async function syncPersistedKeyWithSetting(): Promise<void> {
  const enabled = await isPersistUnlockEnabled();
  if (enabled) {
    if (!currentKey) return;
    try {
      const jwk = await exportKeyToJwk(currentKey);
      await chrome.storage.local.set({ [STORAGE_KEY_PERSISTED]: jwk });
    } catch (err) {
      console.warn('[ProcuAsist] Could not persist vault key:', err);
    }
  } else {
    await chrome.storage.local.remove(STORAGE_KEY_PERSISTED);
  }
}

/** Full sign-out: clear memory and remove the persisted key. */
export async function forgetPersistedKey(): Promise<void> {
  currentKey = null;
  await chrome.storage.local.remove(STORAGE_KEY_PERSISTED);
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
  await persistKey(key);
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
      await persistKey(key);
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

/**
 * Encrypted credential CRUD.
 * Credentials are encrypted with the user's master key (derived from PIN)
 * and stored in chrome.storage.local. They never leave the device.
 */

import { encrypt, decrypt } from '@/modules/crypto/aes-gcm';
import { getKey } from '@/modules/crypto/key-manager';
import type {
  PortalId,
  PortalCredentials,
  EncryptedCredential,
} from '@/modules/portals/types';

const STORAGE_PREFIX = 'tl_cred_';

/** Save credentials for a portal (encrypted) */
export async function saveCredentials(
  portal: PortalId,
  credentials: PortalCredentials
): Promise<void> {
  const key = getKey();
  if (!key) throw new Error('Vault is locked. Enter PIN first.');

  const plaintext = JSON.stringify(credentials);
  const { iv, ciphertext } = await encrypt(key, plaintext);

  // Get current salt for reference
  const stored = await chrome.storage.local.get('tl_master_salt');
  const salt = arrayToBase64(stored.tl_master_salt as number[]);

  const blob: EncryptedCredential = { iv, ciphertext, salt };
  await chrome.storage.local.set({ [`${STORAGE_PREFIX}${portal}`]: blob });
}

/** Get decrypted credentials for a portal */
export async function getCredentials(
  portal: PortalId
): Promise<PortalCredentials | null> {
  const key = getKey();
  if (!key) throw new Error('Vault is locked. Enter PIN first.');

  const stored = await chrome.storage.local.get(`${STORAGE_PREFIX}${portal}`);
  const blob = stored[`${STORAGE_PREFIX}${portal}`] as
    | EncryptedCredential
    | undefined;

  if (!blob) return null;

  const plaintext = await decrypt(key, blob.iv, blob.ciphertext);
  return JSON.parse(plaintext) as PortalCredentials;
}

/** Check if credentials exist for a portal */
export async function hasCredentials(portal: PortalId): Promise<boolean> {
  const stored = await chrome.storage.local.get(`${STORAGE_PREFIX}${portal}`);
  return !!stored[`${STORAGE_PREFIX}${portal}`];
}

/** Delete credentials for a portal */
export async function deleteCredentials(portal: PortalId): Promise<void> {
  await chrome.storage.local.remove(`${STORAGE_PREFIX}${portal}`);
}

function arrayToBase64(arr: number[]): string {
  let binary = '';
  for (const byte of arr) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

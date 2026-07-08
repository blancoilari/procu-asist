/**
 * Encrypted credential CRUD.
 * Credentials are encrypted with the device key (see modules/crypto/key-manager)
 * and stored in chrome.storage.local. They never leave the device.
 */

import { encrypt, decrypt } from '@/modules/crypto/aes-gcm';
import { ensureKey } from '@/modules/crypto/key-manager';
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
  const key = await ensureKey();
  const plaintext = JSON.stringify(credentials);
  const { iv, ciphertext } = await encrypt(key, plaintext);

  const blob: EncryptedCredential = { iv, ciphertext };
  await chrome.storage.local.set({ [`${STORAGE_PREFIX}${portal}`]: blob });
}

/**
 * Get decrypted credentials for a portal. Devuelve null si no hay
 * credenciales o si el blob no descifra con la clave actual.
 *
 * Los blobs del esquema PIN viejo se reconocen por el campo `salt`: sin el
 * PIN son indescifrables para siempre, así que se descartan para que la UI
 * vuelva a pedir las credenciales (camino de migración esperado). Un blob
 * del esquema nuevo que no descifra, en cambio, NO se borra: puede ser una
 * clave persistida corrupta y borrar destruiría datos; con devolver null la
 * UI pide recargarlas y el próximo guardado pisa el blob.
 */
export async function getCredentials(
  portal: PortalId
): Promise<PortalCredentials | null> {
  const stored = await chrome.storage.local.get(`${STORAGE_PREFIX}${portal}`);
  const blob = stored[`${STORAGE_PREFIX}${portal}`] as
    | EncryptedCredential
    | undefined;

  if (!blob) return null;

  const key = await ensureKey();
  try {
    const plaintext = await decrypt(key, blob.iv, blob.ciphertext);
    return JSON.parse(plaintext) as PortalCredentials;
  } catch {
    if (blob.salt) {
      console.warn(
        `[ProcuAsist] Stored ${portal} credentials belong to the old PIN scheme and can't be decrypted — discarding them. Re-enter them in Ajustes.`
      );
      await deleteCredentials(portal);
      notifyCredentialsNeedReentry(portal);
    } else {
      console.warn(
        `[ProcuAsist] Stored ${portal} credentials can't be decrypted with the current key. Re-enter them in Ajustes to overwrite.`
      );
    }
    return null;
  }
}

/**
 * Aviso de migración: al descartar credenciales del esquema PIN viejo, el
 * usuario tiene que enterarse (si no, el auto-login deja de funcionar en
 * silencio). Best-effort: en contextos sin permiso de notificaciones falla
 * callado y queda el console.warn.
 */
function notifyCredentialsNeedReentry(portal: PortalId): void {
  try {
    chrome.notifications?.create(`cred-reentry-${portal}`, {
      type: 'basic',
      iconUrl: '/icon/128.png',
      title: 'ProcuAsist - Volvé a cargar tus credenciales',
      message: `Con la nueva versión (sin PIN), las credenciales guardadas de ${portal.toUpperCase()} deben cargarse de nuevo en Ajustes para que el auto-login siga funcionando.`,
    });
  } catch {
    // sin permiso o contexto sin chrome.notifications: alcanza el warn
  }
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

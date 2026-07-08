/**
 * Manages the device CryptoKey lifecycle.
 *
 * Las credenciales de portales se cifran con una clave AES-256-GCM generada
 * automáticamente la primera vez que hace falta ("clave de dispositivo").
 * No hay PIN: la clave se persiste en chrome.storage.local y se restaura
 * tras cada reinicio del service worker MV3 (~30s de inactividad) o del
 * navegador, así el auto-login y la reconexión nunca se quedan sin clave.
 *
 * Nota de seguridad: la clave vive junto a las credenciales cifradas, de
 * modo que quien tenga acceso al perfil de Chrome desbloqueado puede
 * descifrarlas. Es una decisión deliberada de comodidad sobre seguridad,
 * pedida explícitamente por los usuarios: el cifrado protege el archivo en
 * disco frente a lecturas casuales, no frente a un atacante con la sesión
 * del sistema operativo abierta.
 *
 * Migración desde el esquema viejo (PIN + PBKDF2): si existe una clave
 * persistida (`tl_persisted_key`, usuarios que tenían "mantener sesión
 * iniciada"), se adopta tal cual y las credenciales existentes siguen
 * descifrando. Si el usuario tenía PIN pero sin clave persistida, las
 * credenciales viejas son indescifrables (AES-GCM no tiene recuperación):
 * el credential-store las descarta y el usuario las carga de nuevo una vez.
 */

import {
  generateAesKey,
  exportKeyToJwk,
  importKeyFromJwk,
} from './aes-gcm';

const STORAGE_KEY_PERSISTED = 'tl_persisted_key';
/** Claves del esquema PIN viejo, se limpian al arrancar. */
const LEGACY_VAULT_KEYS = ['tl_master_salt', 'tl_pin_test'];

let currentKey: CryptoKey | null = null;
/** Deduplica generaciones concurrentes (dos mensajes SAVE/GET simultáneos). */
let pendingKey: Promise<CryptoKey> | null = null;

/**
 * Resolve the device key: memory → storage.local → generate & persist.
 * Nunca devuelve null: si no hay clave, se crea una en el momento.
 */
export async function ensureKey(): Promise<CryptoKey> {
  if (currentKey) return currentKey;
  if (!pendingKey) {
    pendingKey = loadOrCreateKey().finally(() => {
      pendingKey = null;
    });
  }
  return pendingKey;
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_PERSISTED);
  const jwk = stored[STORAGE_KEY_PERSISTED] as JsonWebKey | undefined;

  if (jwk) {
    try {
      currentKey = await importKeyFromJwk(jwk);
      return currentKey;
    } catch (err) {
      console.warn(
        '[ProcuAsist] Persisted device key is corrupt — generating a new one:',
        err
      );
    }
  }

  const key = await generateAesKey();
  const exported = await exportKeyToJwk(key);
  await chrome.storage.local.set({ [STORAGE_KEY_PERSISTED]: exported });
  currentKey = key;
  return key;
}

/**
 * Limpieza única del material del esquema PIN viejo (salt PBKDF2 y valor de
 * prueba). Idempotente; se llama al arrancar el service worker.
 */
export async function cleanupLegacyVault(): Promise<void> {
  try {
    await chrome.storage.local.remove(LEGACY_VAULT_KEYS);
  } catch {
    // storage no disponible: nada que limpiar
  }
}

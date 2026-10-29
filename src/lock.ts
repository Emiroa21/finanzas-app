/**
 * Bloqueo local de la app con PIN y, opcionalmente, Face ID mediante una passkey.
 * No hay servidor: la passkey solo sirve para que iOS pida Face ID antes de abrir.
 */
const PIN_KEY = 'lockPinHash'
const CRED_KEY = 'lockCredentialId'

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

async function hashPin(pin: string): Promise<string> {
  return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`finanzas:${pin}`)))
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const lockEnabled = () => read(PIN_KEY) !== null
export const faceIdEnabled = () => read(CRED_KEY) !== null

export async function setPin(pin: string) {
  localStorage.setItem(PIN_KEY, await hashPin(pin))
}

export async function checkPin(pin: string): Promise<boolean> {
  return (await hashPin(pin)) === read(PIN_KEY)
}

export function disableLock() {
  localStorage.removeItem(PIN_KEY)
  localStorage.removeItem(CRED_KEY)
}

export async function faceIdAvailable(): Promise<boolean> {
  try {
    return (await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()) ?? false
  } catch {
    return false
  }
}

export async function enableFaceId(): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'Mis Finanzas' },
      user: { id: random(16), name: 'Mis Finanzas', displayName: 'Mis Finanzas' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('No se pudo activar Face ID.')
  localStorage.setItem(CRED_KEY, b64(cred.rawId))
}

export async function unlockWithFaceId(): Promise<boolean> {
  const id = read(CRED_KEY)
  if (!id) return false
  try {
    const cred = await navigator.credentials.get({
      publicKey: { challenge: random(32), allowCredentials: [{ type: 'public-key', id: fromB64(id) }], userVerification: 'required', timeout: 60000 },
    })
    return cred !== null
  } catch {
    return false
  }
}

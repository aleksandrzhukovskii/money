/**
 * Biometric unlock using WebAuthn with PRF extension.
 * Supports Face ID (iOS), Touch ID (macOS), Windows Hello.
 *
 * Flow:
 *  - Register: create WebAuthn credential → get PRF output → HKDF-derive AES key → encrypt password → store config
 *  - Authenticate: get credential with PRF → derive same key → decrypt password → return it
 */

const STORAGE_KEY = 'money-tracker-biometric'

interface BiometricConfig {
  credentialId: string   // base64
  encryptedPassword: string // base64
  nonce: string          // base64 (AES-GCM IV)
}

interface PRFExtension {
  prf?: { eval?: { first: ArrayBuffer } }
}

interface PRFExtensionResults {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } }
}

// --- helpers ---

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function getPRFSalt(): ArrayBuffer {
  return new TextEncoder().encode('money-tracker-biometric-prf-salt').buffer as ArrayBuffer
}

async function deriveKeyFromPRF(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('money-tracker-biometric-key'),
      info: new TextEncoder().encode('encryption-key'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// --- public API ---

export async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false
  try {
    if (!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) return false
  } catch {
    return false
  }

  // PRF support: iOS 17.4+, Chrome 116+, Safari 17.4+ on macOS
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) {
    const m = ua.match(/OS (\d+)_(\d+)/)
    if (m) {
      const major = parseInt(m[1]!)
      const minor = parseInt(m[2]!)
      return major > 17 || (major === 17 && minor >= 4)
    }
    return false
  }
  if (/Chrome\/(\d+)/.test(ua)) {
    const m = ua.match(/Chrome\/(\d+)/)
    return !!m && parseInt(m[1]!) >= 116
  }
  if (/Safari/.test(ua) && /Macintosh/.test(ua) && !/Chrome/.test(ua)) {
    const m = ua.match(/Version\/(\d+)\.(\d+)/)
    if (m) {
      const major = parseInt(m[1]!)
      const minor = parseInt(m[2]!)
      return major > 17 || (major === 17 && minor >= 4)
    }
  }
  return false
}

export function hasBiometricCredential(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function removeBiometric(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getBiometricName(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return 'Face ID'
  if (/Macintosh/.test(ua)) return 'Touch ID'
  if (/Windows/.test(ua)) return 'Windows Hello'
  return 'Biometric'
}

export async function registerBiometric(password: string): Promise<boolean> {
  const salt = getPRFSalt()
  const userId = crypto.getRandomValues(new Uint8Array(16))
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  // Step 1: create credential with PRF
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Money Tracker', id: window.location.hostname },
      user: { id: userId, name: 'user', displayName: 'Money Tracker User' },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs & PRFExtension,
    },
  }) as PublicKeyCredential | null

  if (!credential) return false

  // Step 2: check PRF enabled
  const ext = credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & PRFExtensionResults
  if (!ext.prf?.enabled) return false

  // Step 3: authenticate to get PRF output
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credential.rawId, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs & PRFExtension,
    },
  }) as PublicKeyCredential | null

  if (!assertion) return false

  const authExt = assertion.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & PRFExtensionResults
  const prfOutput = authExt.prf?.results?.first
  if (!prfOutput) return false

  // Step 4: derive AES key via HKDF, encrypt password
  const key = await deriveKeyFromPRF(prfOutput)
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(password)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, encoded)

  // Step 5: store config
  const config: BiometricConfig = {
    credentialId: toBase64(credential.rawId),
    encryptedPassword: toBase64(ciphertext),
    nonce: toBase64(nonce.buffer as ArrayBuffer),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  return true
}

export async function authenticateWithBiometric(): Promise<string> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) throw new Error('No biometric credential stored')

  const config: BiometricConfig = JSON.parse(stored)
  const credentialId = fromBase64(config.credentialId)
  const salt = getPRFSalt()

  // Authenticate with PRF
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credentialId.buffer as ArrayBuffer, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs & PRFExtension,
    },
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('Biometric authentication cancelled')

  const ext = assertion.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & PRFExtensionResults
  const prfOutput = ext.prf?.results?.first
  if (!prfOutput) throw new Error('PRF output not available')

  // Derive key and decrypt password
  const key = await deriveKeyFromPRF(prfOutput)
  const nonce = fromBase64(config.nonce)
  const ciphertext = fromBase64(config.encryptedPassword)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource },
    key,
    ciphertext as BufferSource,
  )

  return new TextDecoder().decode(plaintext)
}

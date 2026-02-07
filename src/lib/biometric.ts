const STORAGE_KEY = 'money-tracker-biometric'

interface BiometricData {
  credentialId: string // base64url
  iv: string // base64
  encryptedPassword: string // base64
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function getPrfSalt(): Promise<Uint8Array> {
  const data = new TextEncoder().encode('money-tracker-biometric-v1')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hash)
}

async function deriveAesKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    prfOutput,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function hasBiometricCredential(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function removeBiometric(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export async function registerBiometric(password: string): Promise<boolean> {
  const salt = await getPrfSalt()

  // Step 1: Create credential with PRF extension
  const userId = crypto.getRandomValues(new Uint8Array(16))
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Money Tracker' },
      user: {
        id: userId,
        name: 'user',
        displayName: 'Money Tracker User',
      },
      challenge,
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null

  if (!credential) return false

  // Step 2: Check PRF support
  const extensions = credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
    prf?: { enabled?: boolean }
  }
  if (!extensions.prf?.enabled) return false

  // Step 3: Authenticate to get PRF output
  const authChallenge = crypto.getRandomValues(new Uint8Array(32))
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: authChallenge,
      allowCredentials: [{
        id: credential.rawId,
        type: 'public-key',
      }],
      userVerification: 'required',
      extensions: {
        prf: { eval: { first: salt } },
      } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null

  if (!assertion) return false

  const authExtensions = assertion.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
    prf?: { results?: { first?: ArrayBuffer } }
  }
  const prfOutput = authExtensions.prf?.results?.first
  if (!prfOutput) return false

  // Step 4: Encrypt password with PRF-derived key
  const key = await deriveAesKey(prfOutput)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(password)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  )

  // Step 5: Store in localStorage
  const data: BiometricData = {
    credentialId: toBase64Url(credential.rawId),
    iv: toBase64(iv.buffer as ArrayBuffer),
    encryptedPassword: toBase64(ciphertext),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return true
}

export async function authenticateWithBiometric(): Promise<string> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) throw new Error('No biometric credential stored')

  const data: BiometricData = JSON.parse(stored)
  const salt = await getPrfSalt()
  const credentialId = fromBase64Url(data.credentialId)

  // Authenticate with PRF
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{
        id: credentialId as BufferSource,
        type: 'public-key',
      }],
      userVerification: 'required',
      extensions: {
        prf: { eval: { first: salt } },
      } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('Biometric authentication cancelled')

  const extensions = assertion.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
    prf?: { results?: { first?: ArrayBuffer } }
  }
  const prfOutput = extensions.prf?.results?.first
  if (!prfOutput) throw new Error('PRF output not available')

  // Decrypt password
  const key = await deriveAesKey(prfOutput)
  const iv = fromBase64(data.iv)
  const ciphertext = fromBase64(data.encryptedPassword)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  )

  return new TextDecoder().decode(plaintext)
}

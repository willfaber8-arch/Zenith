/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Letterbox Cryptography Engine
 * Phase 9 · Step 9.2 — Client-Side Hybrid Encryption
 *
 * Scheme:  RSA-OAEP 2048 (key transport) + AES-GCM 256 (payload)
 *
 * Why hybrid?
 *   RSA-OAEP can only encrypt ~214 bytes of plaintext directly with a
 *   2048-bit key. For arbitrary-length messages we generate an ephemeral
 *   AES-GCM 256 key, encrypt the message with it, then RSA-wrap that key
 *   with the recipient's public key. The recipient unwraps the AES key
 *   with their private key and decrypts the ciphertext.
 *
 * Wire format (encrypted_payload):
 *   base64( JSON.stringify({ wrappedKey: base64, iv: base64, ciphertext: base64 }) )
 *
 * Key storage:
 *   JWK-serialised strings in db.userProfile.letterboxPublicKeyJwk /
 *   letterboxPrivateKeyJwk. Private key is extractable (required to
 *   survive page refreshes via IDB round-trip). The keys are only ever
 *   stored client-side — they are never transmitted to the server.
 *
 * SSR safety:
 *   All functions call assertBrowser() and throw on the server.
 *   Import this module only inside useEffect / event handlers.
 * ════════════════════════════════════════════════════════════════
 */

'use client'

export interface LetterboxKeyPair {
  publicKeyJwk:  JsonWebKey
  privateKeyJwk: JsonWebKey
}

interface EncryptedBundle {
  /** RSA-OAEP wrapped AES-GCM 256 key (base64) */
  wrappedKey: string
  /** AES-GCM 96-bit nonce (base64) */
  iv: string
  /** AES-GCM ciphertext + 128-bit authentication tag (base64) */
  ciphertext: string
}

/* ── RSA-OAEP parameters (2048 bits, SHA-256) ──────────────────── */

const RSA_ALGO: RsaHashedKeyGenParams = {
  name:           'RSA-OAEP',
  modulusLength:  2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
  hash:           'SHA-256',
}

const RSA_IMPORT_PARAMS: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
}

/* ── Utility helpers ────────────────────────────────────────────── */

function assertBrowser(): void {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error(
      '[CryptoLetterbox] Web Crypto API unavailable. ' +
      'This module must only be called inside useEffect or event handlers.'
    )
  }
}

function toBase64(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const buf    = new ArrayBuffer(binary.length)
  const view   = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i)
  }
  return buf
}

/* ── Keypair generation ─────────────────────────────────────────── */

/**
 * Generates a fresh RSA-OAEP 2048/SHA-256 keypair.
 * Both keys are exported as JWK strings for persistent IDB storage.
 *
 * Call once per user; subsequent loads should read from db.userProfile.
 */
export async function generateLetterboxKeypair(): Promise<LetterboxKeyPair> {
  assertBrowser()

  const pair = await crypto.subtle.generateKey(
    RSA_ALGO,
    true, // extractable — required for JWK export + IDB persistence
    ['wrapKey', 'unwrapKey'],
  )

  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.publicKey),
    crypto.subtle.exportKey('jwk', pair.privateKey),
  ])

  return { publicKeyJwk, privateKeyJwk }
}

/* ── Encryption ─────────────────────────────────────────────────── */

/**
 * Encrypts a plaintext message for a specific recipient.
 *
 * Flow:
 *   1. Import recipient's RSA public key (wrapKey usage)
 *   2. Generate ephemeral AES-GCM 256 key (encrypt usage)
 *   3. Encrypt plaintext → ciphertext (AES-GCM, random 96-bit IV)
 *   4. Wrap AES key with recipient's RSA-OAEP public key
 *   5. Bundle { wrappedKey, iv, ciphertext } → base64 JSON string
 *
 * @param messageText        Plaintext to encrypt
 * @param recipientPublicKey Recipient's JWK public key (from their profile)
 * @returns                  Opaque base64 string suitable for cloud_letterbox.encrypted_payload
 */
export async function encryptLetterboxMessage(
  messageText:        string,
  recipientPublicKey: JsonWebKey,
): Promise<string> {
  assertBrowser()

  // Import recipient's RSA public key for key-wrapping only
  const rsaPublicKey = await crypto.subtle.importKey(
    'jwk',
    recipientPublicKey,
    RSA_IMPORT_PARAMS,
    false,        // not extractable — import-only
    ['wrapKey'],
  )

  // Generate a fresh ephemeral AES-GCM 256 key for this message only
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,         // must be extractable for wrapKey
    ['encrypt'],
  )

  // Encrypt the plaintext with AES-GCM (96-bit random nonce)
  const iv      = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(messageText)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded,
  )

  // Wrap the AES key with the recipient's RSA-OAEP public key
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',       // AES key format inside the RSA envelope
    aesKey,
    rsaPublicKey,
    { name: 'RSA-OAEP' },
  )

  const bundle: EncryptedBundle = {
    wrappedKey: toBase64(wrappedKey),
    iv:         toBase64(iv),
    ciphertext: toBase64(ciphertext),
  }

  return btoa(JSON.stringify(bundle))
}

/* ── Decryption ─────────────────────────────────────────────────── */

/**
 * Decrypts a ciphertext bundle using the local user's private key.
 *
 * Flow:
 *   1. Parse base64 bundle → { wrappedKey, iv, ciphertext }
 *   2. Import own RSA private key (unwrapKey usage)
 *   3. Unwrap the AES-GCM 256 key from the RSA envelope
 *   4. Decrypt ciphertext → plaintext (AES-GCM)
 *
 * Throws on:
 *   • Malformed bundle (bad base64 / JSON)
 *   • Wrong private key (RSA unwrap fails)
 *   • Tampered ciphertext (AES-GCM authentication tag mismatch)
 *
 * @param cipherBase64  The encrypted_payload value from cloud_letterbox
 * @param ownPrivateKey The local user's JWK private key
 * @returns             Original plaintext string
 */
export async function decryptLetterboxMessage(
  cipherBase64:  string,
  ownPrivateKey: JsonWebKey,
): Promise<string> {
  assertBrowser()

  let bundle: EncryptedBundle
  try {
    bundle = JSON.parse(atob(cipherBase64)) as EncryptedBundle
  } catch {
    throw new Error('[CryptoLetterbox] Malformed encrypted bundle — invalid base64 or JSON.')
  }

  if (!bundle.wrappedKey || !bundle.iv || !bundle.ciphertext) {
    throw new Error('[CryptoLetterbox] Incomplete bundle — missing wrappedKey, iv, or ciphertext.')
  }

  // Import own RSA private key for key-unwrapping only
  const rsaPrivateKey = await crypto.subtle.importKey(
    'jwk',
    ownPrivateKey,
    RSA_IMPORT_PARAMS,
    false,          // not extractable — unwrap-only
    ['unwrapKey'],
  )

  // Recover the ephemeral AES key from the RSA envelope
  const aesKey = await crypto.subtle.unwrapKey(
    'raw',
    fromBase64(bundle.wrappedKey),
    rsaPrivateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    false,          // not extractable — decrypt-only
    ['decrypt'],
  )

  // Decrypt the ciphertext (AES-GCM also verifies the authentication tag)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(bundle.iv) },
    aesKey,
    fromBase64(bundle.ciphertext),
  )

  return new TextDecoder().decode(plaintext)
}

/* ── Public key serialization helpers ──────────────────────────── */

/**
 * Serialises a JWK public key to a compact JSON string for sharing
 * over the WebRTC data channel or peer sync payload.
 */
export function serialisePublicKey(publicKeyJwk: JsonWebKey): string {
  return JSON.stringify(publicKeyJwk)
}

/**
 * Parses a JSON string back into a JsonWebKey for use with
 * encryptLetterboxMessage().
 */
export function parsePublicKey(raw: string): JsonWebKey {
  return JSON.parse(raw) as JsonWebKey
}

'use node'

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import type { Infer } from 'convex/values'
import { encryptedSecretValidator } from './googleHealthValidators'

export type EncryptedSecret = Infer<typeof encryptedSecretValidator>

function encryptionKey() {
  const encoded = process.env.GOOGLE_HEALTH_CREDENTIALS_KEY?.trim()
  if (!encoded)
    throw new Error('GOOGLE_HEALTH_CREDENTIALS_KEY is not configured')
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    throw new Error(
      'GOOGLE_HEALTH_CREDENTIALS_KEY must be a base64-encoded 32-byte key',
    )
  }
  return key
}

export function encryptHealthSecret(
  value: string,
  associatedData: string,
): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(associatedData, 'utf8'))
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ])
  return {
    version: 1,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptHealthSecret(
  secret: EncryptedSecret,
  associatedData: string,
) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(secret.iv, 'base64'),
  )
  decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function hashHealthValue(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

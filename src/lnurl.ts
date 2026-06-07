import { bech32 } from '@scure/base'
import { secp256k1 } from '@noble/curves/secp256k1'

// LNURL strings can exceed bech32's default 90-char limit; LUD-01 raises it.
const BECH32_LIMIT = 2000

/** Encode a URL as an uppercase LNURL bech32 string (LUD-01). */
export function encodeLnurl(url: string): string {
  const words = bech32.toWords(new TextEncoder().encode(url))
  return bech32.encode('lnurl', words, BECH32_LIMIT).toUpperCase()
}

/** Decode an LNURL bech32 string back to its URL. */
export function decodeLnurl(lnurl: string): string {
  const decoded = bech32.decode(lnurl.toLowerCase() as `${string}1${string}`, BECH32_LIMIT)
  return new TextDecoder().decode(Uint8Array.from(bech32.fromWords(decoded.words)))
}

/** A 33-byte compressed secp256k1 public key in lowercase hex. */
const COMPRESSED_PUBKEY = /^0[23][0-9a-f]{64}$/

/**
 * Verify an LNURL-auth signature (LUD-04): the wallet signs the raw 32-byte k1
 * challenge (used directly as the ECDSA digest) with its linking key, producing
 * a DER signature. `key` is the compressed linking pubkey.
 */
export function verifyLnurlAuthSig(k1Hex: string, sigDerHex: string, keyHex: string): boolean {
  const key = keyHex.toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(k1Hex.toLowerCase()) || !COMPRESSED_PUBKEY.test(key)) {
    return false
  }
  try {
    const signature = secp256k1.Signature.fromDER(sigDerHex)
    // lowS:false — wallets may emit non-normalized signatures; malleability is
    // irrelevant here since we only check the holder controls the linking key.
    return secp256k1.verify(signature, k1Hex.toLowerCase(), key, { lowS: false })
  } catch {
    return false
  }
}

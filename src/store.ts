import { randomBytes } from 'node:crypto'

/** Pending login started at /authorize, awaiting an LNURL-auth signature. */
export interface AuthRequest {
  k1: string
  sessionId: string
  clientId: string
  redirectUri: string
  state?: string
  nonce?: string
  scope: string
  codeChallenge?: string
  codeChallengeMethod?: string
  createdAt: number
  status: 'pending' | 'signed'
  /** Lowercase-hex wallet pubkey, once signed. */
  pubkey?: string
  /** Authorization code issued once signed. */
  code?: string
}

/** A one-time authorization code, exchanged at /token for an ID token. */
export interface AuthCode {
  code: string
  pubkey: string
  clientId: string
  redirectUri: string
  nonce?: string
  codeChallenge?: string
  codeChallengeMethod?: string
  createdAt: number
}

export const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000
export const AUTH_CODE_TTL_MS = 60 * 1000

const hex = (bytes: number) => randomBytes(bytes).toString('hex')

/**
 * In-memory stores for the LNURL-auth → OIDC flow. Ephemeral by design:
 * pending challenges and codes are short-lived, so nothing needs to survive a
 * restart. Entries are swept lazily on access.
 */
export class AuthStore {
  private byK1 = new Map<string, AuthRequest>()
  private bySession = new Map<string, string>()
  private codes = new Map<string, AuthCode>()

  /**
   * `clock` is injectable so expiry can be tested deterministically.
   * `maxEntries` bounds each map so an anonymous flood of /authorize calls
   * can't grow memory without limit — at capacity the oldest entry is evicted.
   */
  constructor(
    private readonly clock: () => number = () => Date.now(),
    private readonly maxEntries = 10_000,
  ) {}

  private now(): number {
    return this.clock()
  }

  /** Drop the oldest (insertion-order) entry when a map is at capacity. */
  private capRequests(): void {
    if (this.byK1.size < this.maxEntries) return
    const oldest = this.byK1.keys().next().value
    if (oldest === undefined) return
    const req = this.byK1.get(oldest)
    this.byK1.delete(oldest)
    if (req) this.bySession.delete(req.sessionId)
  }

  private capCodes(): void {
    if (this.codes.size < this.maxEntries) return
    const oldest = this.codes.keys().next().value
    if (oldest !== undefined) this.codes.delete(oldest)
  }

  /** Start a login: allocate a fresh k1 + browser session. */
  createAuthRequest(
    input: Omit<AuthRequest, 'k1' | 'sessionId' | 'createdAt' | 'status'>,
  ): AuthRequest {
    this.capRequests()
    const req: AuthRequest = {
      ...input,
      k1: hex(32),
      sessionId: hex(32),
      createdAt: this.now(),
      status: 'pending',
    }
    this.byK1.set(req.k1, req)
    this.bySession.set(req.sessionId, req.k1)
    return req
  }

  getByK1(k1: string): AuthRequest | undefined {
    return this.alive(this.byK1.get(k1))
  }

  getBySession(sessionId: string): AuthRequest | undefined {
    const k1 = this.bySession.get(sessionId)
    return k1 ? this.getByK1(k1) : undefined
  }

  /** Mark a request signed and mint its authorization code. Idempotent. */
  markSigned(req: AuthRequest, pubkey: string): AuthCode {
    if (req.status === 'signed' && req.code) {
      const existing = this.codes.get(req.code)
      if (existing) return existing
    }
    this.capCodes()
    const code: AuthCode = {
      code: randomBytes(32).toString('base64url'),
      pubkey,
      clientId: req.clientId,
      redirectUri: req.redirectUri,
      nonce: req.nonce,
      codeChallenge: req.codeChallenge,
      codeChallengeMethod: req.codeChallengeMethod,
      createdAt: this.now(),
    }
    req.status = 'signed'
    req.pubkey = pubkey
    req.code = code.code
    this.codes.set(code.code, code)
    return code
  }

  /** Consume an authorization code (single use). */
  takeCode(code: string): AuthCode | undefined {
    const entry = this.codes.get(code)
    if (!entry) return undefined
    this.codes.delete(code)
    if (this.now() - entry.createdAt > AUTH_CODE_TTL_MS) return undefined
    return entry
  }

  private alive(req: AuthRequest | undefined): AuthRequest | undefined {
    if (!req) return undefined
    if (this.now() - req.createdAt > AUTH_REQUEST_TTL_MS) {
      this.byK1.delete(req.k1)
      this.bySession.delete(req.sessionId)
      return undefined
    }
    return req
  }
}

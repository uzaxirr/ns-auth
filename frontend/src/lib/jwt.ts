export interface DecodedJWT {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  raw: string
}

function decodeBase64Url(str: string): Record<string, unknown> {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  return JSON.parse(atob(padded))
}

export function decodeJWT(token: string): DecodedJWT | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    return {
      header: decodeBase64Url(parts[0]),
      payload: decodeBase64Url(parts[1]),
      signature: parts[2],
      raw: token,
    }
  } catch {
    return null
  }
}

export function formatTimestamp(epoch: number): string {
  return new Date(epoch * 1000).toLocaleString()
}

export function isTokenExpired(payload: Record<string, unknown>): boolean {
  const exp = payload.exp as number | undefined
  if (!exp) return false
  return Date.now() / 1000 > exp
}

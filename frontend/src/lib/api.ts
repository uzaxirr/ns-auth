export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.error_description || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface OAuthAppCreate {
  name: string
  description?: string
  scopes?: string[]
  redirect_uris?: string[]
}

export interface OAuthApp {
  id: string
  name: string
  description: string | null
  client_id: string
  scopes: string[]
  redirect_uris: string[]
  created_at: string
  updated_at: string
}

export interface OAuthAppCreated extends OAuthApp {
  client_secret: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

export interface IntrospectResponse {
  active: boolean
  scope?: string
  client_id?: string
  token_type?: string
  exp?: number
  iat?: number
  jti?: string
  iss?: string
}

export const api = {
  createApp: (data: OAuthAppCreate) =>
    request<OAuthAppCreated>("/api/apps/", { method: "POST", body: JSON.stringify(data) }),

  listApps: () => request<OAuthApp[]>("/api/apps/"),

  getApp: (id: string) => request<OAuthApp>(`/api/apps/${id}`),

  deleteApp: (id: string) => request<void>(`/api/apps/${id}`, { method: "DELETE" }),

  getToken: (clientId: string, clientSecret: string, scope?: string) => {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    })
    if (scope) body.set("scope", scope)
    return fetch(`${API_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).then(r => r.json()) as Promise<TokenResponse>
  },

  introspectToken: (token: string) => {
    const body = new URLSearchParams({ token })
    return fetch(`${API_BASE}/oauth/token/introspect`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).then(r => r.json()) as Promise<IntrospectResponse>
  },

  revokeToken: (token: string) => {
    const body = new URLSearchParams({ token })
    return fetch(`${API_BASE}/oauth/token/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).then(r => r.json())
  },
}

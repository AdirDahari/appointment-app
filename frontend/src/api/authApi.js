import { request, setToken } from './http'

export async function login(username, password) {
  const session = await request('/auth/login', { method: 'POST', body: { username, password }, auth: false })
  setToken(session.token)
  return session
}

// Validates the stored token and stores the refreshed one the server returns,
// which is what keeps the owner logged in indefinitely while she uses the app.
export async function refreshSession() {
  const session = await request('/auth/me')
  setToken(session.token)
  return session
}

export function logout() {
  setToken(null)
}

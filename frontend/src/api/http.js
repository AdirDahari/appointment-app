// Shared fetch wrapper: API base URL, owner token, unified error messages.
//
// VITE_API_BASE_URL is empty when the frontend is served by the backend (or
// through Vite's dev proxy) and set to the backend's URL when the frontend is
// hosted elsewhere (e.g. Vercel -> EC2).
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const TOKEN_KEY = 'owner_session_token'

export const AUTH_LOGOUT_EVENT = 'auth:logout'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private mode / blocked storage: the session simply won't persist.
  }
}

export async function parseErrorMessage(response) {
  try {
    const data = await response.json()
    const detail = data.detail
    // FastAPI validation errors (422) arrive as a list of {msg, loc, ...}.
    if (Array.isArray(detail)) {
      const first = detail[0]?.msg || ''
      return first.replace(/^Value error, /, '') || 'הנתונים שהוזנו אינם תקינים'
    }
    return detail || 'שגיאה לא צפויה'
  } catch {
    return 'שגיאה לא צפויה'
  }
}

export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    const error = new Error('אין חיבור לשרת. בדקי את החיבור לאינטרנט')
    error.status = 0
    throw error
  }

  if (response.status === 401 && auth) {
    // Token expired or SECRET_KEY rotated — drop it and let App show the login.
    setToken(null)
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
  }

  if (!response.ok) {
    const error = new Error(await parseErrorMessage(response))
    error.status = response.status
    throw error
  }
  if (response.status === 204) return null
  return response.json()
}

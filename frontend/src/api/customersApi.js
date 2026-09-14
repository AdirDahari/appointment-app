const BASE_URL = '/customers'

async function parseErrorMessage(response) {
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

export async function getCustomers(search = '') {
  const url = search ? `${BASE_URL}?search=${encodeURIComponent(search)}` : BASE_URL
  const response = await fetch(url)
  if (!response.ok) throw new Error(await parseErrorMessage(response))
  return response.json()
}

export async function getCustomer(id) {
  const response = await fetch(`${BASE_URL}/${id}`)
  if (!response.ok) throw new Error(await parseErrorMessage(response))
  return response.json()
}

export async function createCustomer(data) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(await parseErrorMessage(response))
  return response.json()
}

export async function updateCustomer(id, data) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(await parseErrorMessage(response))
  return response.json()
}

export async function deleteCustomer(id, { force = false } = {}) {
  const url = force ? `${BASE_URL}/${id}?force=true` : `${BASE_URL}/${id}`
  const response = await fetch(url, { method: 'DELETE' })
  if (!response.ok) {
    const error = new Error(await parseErrorMessage(response))
    error.status = response.status
    throw error
  }
}

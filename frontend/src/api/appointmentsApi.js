const BASE_URL = '/appointments'

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

export async function getAppointments({ reminderSent } = {}) {
  const url = reminderSent === undefined ? BASE_URL : `${BASE_URL}?reminder_sent=${reminderSent}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(await parseErrorMessage(response))
  return response.json()
}

export async function createAppointment(data) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(await parseErrorMessage(response))
  return response.json()
}

export async function updateAppointment(id, data) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(await parseErrorMessage(response))
  return response.json()
}

export async function deleteAppointment(id) {
  const response = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await parseErrorMessage(response))
}

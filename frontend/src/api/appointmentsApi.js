const BASE_URL = '/appointments'

async function parseErrorMessage(response) {
  try {
    const data = await response.json()
    return data.detail || 'שגיאה לא צפויה'
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

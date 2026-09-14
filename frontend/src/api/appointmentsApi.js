import { request } from './http'

const BASE_URL = '/appointments'

export function getAppointments({ reminderSent } = {}) {
  const url = reminderSent === undefined ? BASE_URL : `${BASE_URL}?reminder_sent=${reminderSent}`
  return request(url)
}

export function createAppointment(data) {
  return request(BASE_URL, { method: 'POST', body: data })
}

export function updateAppointment(id, data) {
  return request(`${BASE_URL}/${id}`, { method: 'PATCH', body: data })
}

export function deleteAppointment(id) {
  return request(`${BASE_URL}/${id}`, { method: 'DELETE' })
}

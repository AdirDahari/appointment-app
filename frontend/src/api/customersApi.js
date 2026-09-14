import { request } from './http'

const BASE_URL = '/customers'

export function getCustomers(search = '') {
  const url = search ? `${BASE_URL}?search=${encodeURIComponent(search)}` : BASE_URL
  return request(url)
}

export function getCustomer(id) {
  return request(`${BASE_URL}/${id}`)
}

export function createCustomer(data) {
  return request(BASE_URL, { method: 'POST', body: data })
}

export function updateCustomer(id, data) {
  return request(`${BASE_URL}/${id}`, { method: 'PATCH', body: data })
}

export function deleteCustomer(id, { force = false } = {}) {
  const url = force ? `${BASE_URL}/${id}?force=true` : `${BASE_URL}/${id}`
  return request(url, { method: 'DELETE' })
}

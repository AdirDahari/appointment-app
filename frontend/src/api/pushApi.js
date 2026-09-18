import { request } from './http'

export function getPushConfig() {
  return request('/push/config')
}

export function subscribePush(subscriptionJson) {
  return request('/push/subscribe', { method: 'POST', body: subscriptionJson })
}

export function unsubscribePush(endpoint) {
  return request('/push/unsubscribe', { method: 'POST', body: { endpoint } })
}

export function sendTestPush() {
  return request('/push/test', { method: 'POST' })
}

export function getPushPreferences() {
  return request('/push/preferences')
}

export function updatePushPreferences(changes) {
  return request('/push/preferences', { method: 'PATCH', body: changes })
}

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

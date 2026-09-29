// Builds the WhatsApp message the owner sends a customer: the appointment's
// details plus a link to the public "add to calendar" page (backend /c/<token>).
import { API_BASE } from '../api/http'

const COUNTRY_CODE = '972'

// Same rules as the backend's normalize_phone_number: 050-123-4567 -> 972501234567.
function toWhatsAppNumber(phoneNumber) {
  let digits = String(phoneNumber || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith(COUNTRY_CODE)) return digits
  if (digits.startsWith('0')) return COUNTRY_CODE + digits.slice(1)
  return digits
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

export function calendarPageUrl(appointment) {
  return `${API_BASE || window.location.origin}/c/${appointment.share_token}`
}

export function whatsAppShareUrl(appointment) {
  const firstName = appointment.customer_name.split(' ')[0]
  const lines = [
    `היי ${firstName} 💅`,
    'התור שלך נקבע:',
    `📅 ${formatDate(appointment.appointment_datetime)}`,
    `🕐 ${formatTime(appointment.appointment_datetime)}–${formatTime(appointment.appointment_end_datetime)}`,
  ]
  if (appointment.appointment_type) lines.push(`💖 ${appointment.appointment_type}`)
  lines.push('', 'להוספה ליומן:', calendarPageUrl(appointment))
  return `https://wa.me/${toWhatsAppNumber(appointment.customer_phone)}?text=${encodeURIComponent(lines.join('\n'))}`
}

export function canShare(appointment) {
  return Boolean(appointment.share_token && appointment.customer_phone)
}

// Offer to share after booking, or after a change the customer needs to know
// about (a new time). A change of type alone isn't worth a message.
export function shouldOfferShare(previous, saved) {
  if (!canShare(saved)) return false
  if (!previous) return true
  return (
    previous.appointment_datetime !== saved.appointment_datetime ||
    previous.appointment_end_datetime !== saved.appointment_end_datetime
  )
}

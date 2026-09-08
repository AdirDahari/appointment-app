import { useState } from 'react'
import { createAppointment, updateAppointment } from '../api/appointmentsApi'
import CustomerAutocomplete from './CustomerAutocomplete'
import QuickAddCustomerInline from './QuickAddCustomerInline'
import { initialsOf } from '../utils/initials'
import { PlusIcon } from './Icons'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

function splitDatetime(isoString) {
  if (!isoString) return { date: '', hour: '', minute: '' }
  const [date, time] = isoString.split('T')
  const [hour, minute] = (time || '').slice(0, 5).split(':')
  return { date, hour, minute }
}

function AppointmentForm({ appointment, onSaved, onCancel }) {
  const isEdit = Boolean(appointment)
  const initialDatetime = isEdit ? splitDatetime(appointment.appointment_datetime) : { date: '', hour: '', minute: '' }

  const [customer, setCustomer] = useState(
    isEdit ? { id: appointment.customer_id, full_name: appointment.customer_name } : null,
  )
  const [searchText, setSearchText] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [appointmentDate, setAppointmentDate] = useState(initialDatetime.date)
  const [appointmentHour, setAppointmentHour] = useState(initialDatetime.hour)
  const [appointmentMinute, setAppointmentMinute] = useState(initialDatetime.minute)
  const [appointmentType, setAppointmentType] = useState(isEdit ? appointment.appointment_type || '' : '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function changeCustomer() {
    setCustomer(null)
    setSearchText('')
    setShowQuickAdd(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const appointmentDatetime = `${appointmentDate}T${appointmentHour}:${appointmentMinute}`
    try {
      const saved = isEdit
        ? await updateAppointment(appointment.id, {
            appointment_type: appointmentType.trim() || null,
            appointment_datetime: appointmentDatetime,
          })
        : await createAppointment({
            customer_id: customer.id,
            appointment_type: appointmentType.trim() || null,
            appointment_datetime: appointmentDatetime,
          })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
        <span className="sheet-handle" aria-hidden="true" />
        <h2 className="sheet-title">{isEdit ? 'עריכת תור' : 'תור חדש'}</h2>

        {!customer ? (
          <>
            <div className="field">
              <span className="field-label">בחרי לקוח</span>
              <CustomerAutocomplete value={searchText} onChange={setSearchText} onSelect={setCustomer} />
            </div>

            {searchText.trim() && !showQuickAdd && (
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setShowQuickAdd(true)}>
                <PlusIcon size={18} />
                לקוח חדש
              </button>
            )}

            {showQuickAdd && (
              <QuickAddCustomerInline
                initialName={searchText}
                onCreated={setCustomer}
                onCancel={() => setShowQuickAdd(false)}
              />
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} className="section">
            <div className="selected-customer">
              <span className="avatar" aria-hidden="true">
                {initialsOf(customer.full_name)}
              </span>
              <div className="row-main">
                <span className="row-name">{customer.full_name}</span>
                {customer.phone_number && <span className="row-meta">{customer.phone_number}</span>}
              </div>
              {!isEdit && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={changeCustomer}>
                  שינוי
                </button>
              )}
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="field">
              <label htmlFor="appointment_date">תאריך ושעה</label>
              <div className="datetime-fields">
                <input
                  id="appointment_date"
                  type="date"
                  value={appointmentDate}
                  onChange={(event) => setAppointmentDate(event.target.value)}
                  required
                />
                <select
                  aria-label="שעה"
                  value={appointmentHour}
                  onChange={(event) => setAppointmentHour(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    שעה
                  </option>
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
                <span className="datetime-colon">:</span>
                <select
                  aria-label="דקה"
                  value={appointmentMinute}
                  onChange={(event) => setAppointmentMinute(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    דקה
                  </option>
                  {MINUTES.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="appointment_type">סוג תור</label>
              <input
                id="appointment_type"
                value={appointmentType}
                onChange={(event) => setAppointmentType(event.target.value)}
                placeholder="אופציונלי"
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
                ביטול
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'שומר...' : isEdit ? 'שמירה' : 'קביעת תור'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default AppointmentForm

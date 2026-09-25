import { useEffect, useMemo, useState } from 'react'
import { createAppointment, getAppointments, updateAppointment } from '../api/appointmentsApi'
import CustomerAutocomplete from './CustomerAutocomplete'
import QuickAddCustomerInline from './QuickAddCustomerInline'
import DayTimeline, { toMinutes, toTime } from './DayTimeline'
import { initialsOf } from '../utils/initials'
import { PlusIcon } from './Icons'

// A new appointment is one hour long until the end time is changed by hand.
// Matches DEFAULT_DURATION in the backend's appointment model.
const DEFAULT_MINUTES = 60
const LAST_MINUTE_OF_DAY = 23 * 60 + 59

function addMinutes(time, minutes) {
  return toTime(Math.min(LAST_MINUTE_OF_DAY, toMinutes(time) + minutes))
}

function todayKey() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

function splitDatetime(isoString) {
  if (!isoString) return { date: '', time: '' }
  return { date: isoString.slice(0, 10), time: isoString.slice(11, 16) }
}

// End time as HH:MM on the start's day. An end that spills past midnight
// (only possible for old data) shows as the end of the day.
function endTimeOnDay(startIso, endIso) {
  if (!endIso) return ''
  return endIso.slice(0, 10) > startIso.slice(0, 10) ? '23:59' : endIso.slice(11, 16)
}

function lengthOf(startTime, endTime) {
  return toMinutes(endTime) - toMinutes(startTime)
}

function dayLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function countLabel(count) {
  if (count === 0) return 'היום פנוי'
  if (count === 1) return 'תור אחד'
  return `${count} תורים`
}

function AppointmentForm({ appointment, onSaved, onCancel }) {
  const isEdit = Boolean(appointment)
  const initialDatetime = isEdit ? splitDatetime(appointment.appointment_datetime) : { date: todayKey(), time: '' }
  const initialEndTime = isEdit
    ? endTimeOnDay(appointment.appointment_datetime, appointment.appointment_end_datetime)
    : ''

  const [customer, setCustomer] = useState(
    isEdit ? { id: appointment.customer_id, full_name: appointment.customer_name } : null,
  )
  const [searchText, setSearchText] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [appointmentDate, setAppointmentDate] = useState(initialDatetime.date)
  const [appointmentTime, setAppointmentTime] = useState(initialDatetime.time)
  const [endTime, setEndTime] = useState(initialEndTime)
  // While false, the end time follows the start time at +1 hour. Editing an
  // appointment that already has a different length counts as changed.
  const [endTouched, setEndTouched] = useState(
    isEdit && Boolean(initialEndTime) && lengthOf(initialDatetime.time, initialEndTime) !== DEFAULT_MINUTES,
  )
  const [appointmentType, setAppointmentType] = useState(isEdit ? appointment.appointment_type || '' : '')
  const [allAppointments, setAllAppointments] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // The day view needs every appointment of the chosen day. One small request
  // on open keeps the form self-contained regardless of which page opened it.
  useEffect(() => {
    let cancelled = false
    getAppointments()
      .then((data) => {
        if (!cancelled) setAllAppointments(data)
      })
      .catch(() => {
        // The form still works without the day view.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const editingId = appointment ? appointment.id : null

  const dayAppointments = useMemo(
    () =>
      allAppointments
        .filter((item) => item.appointment_datetime.slice(0, 10) === appointmentDate && item.id !== editingId)
        .map((item) => {
          const time = item.appointment_datetime.slice(11, 16)
          const endTime = item.appointment_end_datetime.slice(11, 16)
          const spillsPastMidnight = item.appointment_end_datetime.slice(0, 10) > appointmentDate
          const endMinutes = spillsPastMidnight ? 24 * 60 : toMinutes(endTime)
          return { ...item, time, endTime, durationMinutes: endMinutes - toMinutes(time) }
        })
        .sort((a, b) => a.time.localeCompare(b.time)),
    [allAppointments, appointmentDate, editingId],
  )

  const endBeforeStart = Boolean(appointmentTime && endTime) && lengthOf(appointmentTime, endTime) <= 0

  const conflict = useMemo(() => {
    if (!appointmentTime || !endTime || endBeforeStart) return null
    const start = toMinutes(appointmentTime)
    const end = toMinutes(endTime)
    return dayAppointments.find((item) => {
      const itemStart = toMinutes(item.time)
      return itemStart < end && itemStart + item.durationMinutes > start
    })
  }, [dayAppointments, appointmentTime, endTime, endBeforeStart])

  function changeStartTime(value) {
    setAppointmentTime(value)
    if (value && !endTouched) setEndTime(addMinutes(value, DEFAULT_MINUTES))
  }

  function changeEndTime(value) {
    setEndTime(value)
    setEndTouched(true)
  }

  function changeCustomer() {
    setCustomer(null)
    setSearchText('')
    setShowQuickAdd(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const times = {
      appointment_datetime: `${appointmentDate}T${appointmentTime}`,
      appointment_end_datetime: `${appointmentDate}T${endTime}`,
    }
    try {
      const saved = isEdit
        ? await updateAppointment(appointment.id, {
            appointment_type: appointmentType.trim() || null,
            ...times,
          })
        : await createAppointment({
            customer_id: customer.id,
            appointment_type: appointmentType.trim() || null,
            ...times,
          })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const canSubmit = Boolean(appointmentDate && appointmentTime && endTime) && !endBeforeStart && !submitting

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
              <label htmlFor="appointment_date">תאריך</label>
              <input
                id="appointment_date"
                type="date"
                value={appointmentDate}
                onChange={(event) => setAppointmentDate(event.target.value)}
                required
              />
            </div>

            <div className="time-range">
              <div className="field">
                <label htmlFor="appointment_time">שעת התחלה</label>
                <input
                  id="appointment_time"
                  type="time"
                  value={appointmentTime}
                  onChange={(event) => changeStartTime(event.target.value)}
                  step="300"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="appointment_end_time">שעת סיום</label>
                <input
                  id="appointment_end_time"
                  type="time"
                  value={endTime}
                  onChange={(event) => changeEndTime(event.target.value)}
                  step="300"
                  required
                />
              </div>
            </div>

            {endBeforeStart && <div className="alert alert-error">שעת הסיום חייבת להיות אחרי שעת ההתחלה</div>}

            {appointmentDate && (
              <div className="day-view">
                <div className="day-view-head">
                  <span className="day-view-title">{dayLabel(appointmentDate)}</span>
                  <span className="day-view-count">{countLabel(dayAppointments.length)}</span>
                </div>

                <DayTimeline
                  appointments={dayAppointments}
                  selectedTime={appointmentTime}
                  selectedEndTime={endBeforeStart ? '' : endTime}
                  selectedMinutes={
                    appointmentTime && endTime && !endBeforeStart ? lengthOf(appointmentTime, endTime) : DEFAULT_MINUTES
                  }
                  onSelect={changeStartTime}
                  previewLabel={customer.full_name}
                />

                <span className="day-view-hint">
                  {appointmentTime
                    ? 'הקישי במקום אחר כדי לשנות את שעת ההתחלה'
                    : 'הקישי על שעה פנויה כדי לבחור את שעת ההתחלה'}
                </span>
              </div>
            )}

            {conflict && (
              <div className="alert alert-note">
                שימי לב: השעה חופפת לתור של {conflict.customer_name} בשעה {conflict.time}
              </div>
            )}

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
              <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
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

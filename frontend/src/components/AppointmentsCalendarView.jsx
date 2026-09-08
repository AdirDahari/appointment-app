import { useMemo, useState } from 'react'
import AppointmentRow from './AppointmentRow'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons'

const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

function toDateKey(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function buildMonthGrid(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = new Date(year, month, 1).getDay()

  const cells = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
  return cells
}

function AppointmentsCalendarView({ appointments, onEdit, onDelete }) {
  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(null)

  const appointmentsByDay = useMemo(() => {
    const map = new Map()
    for (const appointment of appointments) {
      const key = appointment.appointment_datetime.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(appointment)
    }
    return map
  }, [appointments])

  const cells = useMemo(() => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])
  const monthLabel = viewDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
  const todayKey = toDateKey(today)

  function changeMonth(offset) {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1))
    setSelectedDay(null)
  }

  const selectedDayAppointments = selectedDay ? appointmentsByDay.get(selectedDay) || [] : []
  const selectedDayLabel = selectedDay
    ? new Date(`${selectedDay}T00:00:00`).toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

  return (
    <div className="cal-detail">
      <div className="cal-card">
        <div className="cal-head">
          <button type="button" className="cal-nav-btn" onClick={() => changeMonth(-1)} aria-label="חודש קודם">
            <ChevronRightIcon size={18} />
          </button>
          <span className="cal-month">{monthLabel}</span>
          <button type="button" className="cal-nav-btn" onClick={() => changeMonth(1)} aria-label="חודש הבא">
            <ChevronLeftIcon size={18} />
          </button>
        </div>

        <div className="cal-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="cal-weekday">
              {label}
            </div>
          ))}

          {cells.map((date, index) => {
            if (!date) return <div key={`blank-${index}`} />

            const dateKey = toDateKey(date)
            const dayAppointments = appointmentsByDay.get(dateKey) || []
            const reminderStatuses = [
              ...new Set(dayAppointments.filter((appointment) => appointment.reminder_sent_at).map((a) => a.status)),
            ]
            const hasUnreminded = dayAppointments.some((appointment) => !appointment.reminder_sent_at)

            const classNames = ['cal-day']
            if (dateKey === todayKey) classNames.push('is-today')
            if (dateKey === selectedDay) classNames.push('is-selected')

            const countLabel = dayAppointments.length > 0 ? `, ${dayAppointments.length} תורים` : ''

            return (
              <button
                key={dateKey}
                type="button"
                className={classNames.join(' ')}
                aria-label={`${date.getDate()} ב${viewDate.toLocaleDateString('he-IL', { month: 'long' })}${countLabel}`}
                aria-pressed={dateKey === selectedDay}
                onClick={() => setSelectedDay(dateKey)}
              >
                <span>{date.getDate()}</span>
                <span className="cal-dots">
                  {reminderStatuses.map((status) => (
                    <span key={status} className={`cal-dot cal-dot-${status}`} />
                  ))}
                  {hasUnreminded && <span className="cal-dot" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {!selectedDay ? (
        <div className="empty">
          <span className="empty-icon">
            <CalendarIcon size={24} />
          </span>
          <span>הקישי על יום כדי לראות את התורים שלו</span>
        </div>
      ) : selectedDayAppointments.length === 0 ? (
        <div className="empty">
          <span className="empty-title">{selectedDayLabel}</span>
          <span>אין תורים ביום זה</span>
        </div>
      ) : (
        <div className="section">
          <div className="day-label">{selectedDayLabel}</div>
          <ul className="stack">
            {selectedDayAppointments.map((appointment) => (
              <AppointmentRow key={appointment.id} appointment={appointment} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default AppointmentsCalendarView

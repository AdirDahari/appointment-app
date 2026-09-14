import { Fragment, useEffect, useState } from 'react'
import { deleteAppointment, getAppointments } from '../api/appointmentsApi'
import AppointmentForm from '../components/AppointmentForm'
import AppointmentRow from '../components/AppointmentRow'
import AppointmentsCalendarView from '../components/AppointmentsCalendarView'
import { CalendarIcon, PlusIcon } from '../components/Icons'

function groupByDay(appointments) {
  const groups = []
  for (const appointment of appointments) {
    const key = appointment.appointment_datetime.slice(0, 10)
    const currentGroup = groups[groups.length - 1]
    if (currentGroup && currentGroup.key === key) {
      currentGroup.items.push(appointment)
    } else {
      const label = new Date(appointment.appointment_datetime).toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      groups.push({ key, label, items: [appointment] })
    }
  }
  return groups
}

// The list is the "what's next" view: an appointment whose time has passed
// drops out of it (it stays in the DB and in the calendar view). Times are
// naive local ISO strings, so `new Date()` parses them in local time.
function upcomingOnly(appointments) {
  const now = Date.now()
  return appointments.filter((appointment) => new Date(appointment.appointment_datetime).getTime() >= now)
}

function AppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [warning, setWarning] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [view, setView] = useState('list')

  async function loadAppointments() {
    setLoading(true)
    setLoadError('')
    try {
      const data = await getAppointments()
      setAppointments(data)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  function openAddForm() {
    setEditingAppointment(null)
    setShowForm(true)
  }

  function openEditForm(appointment) {
    setEditingAppointment(appointment)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingAppointment(null)
  }

  async function handleSaved(saved) {
    closeForm()
    setWarning(saved.calendar_warning || '')
    await loadAppointments()
  }

  async function handleDelete(appointment) {
    if (!window.confirm(`למחוק את התור של ${appointment.customer_name}?`)) return
    try {
      await deleteAppointment(appointment.id)
      await loadAppointments()
    } catch (err) {
      window.alert(err.message)
    }
  }

  const upcomingAppointments = upcomingOnly(appointments)

  return (
    <main className="page">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="תצוגת תורים">
          <button
            type="button"
            className={`segmented-btn${view === 'list' ? ' active' : ''}`}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            רשימה
          </button>
          <button
            type="button"
            className={`segmented-btn${view === 'calendar' ? ' active' : ''}`}
            aria-pressed={view === 'calendar'}
            onClick={() => setView('calendar')}
          >
            יומן
          </button>
        </div>
        <button type="button" className="round-btn" aria-label="תור חדש" onClick={openAddForm}>
          <PlusIcon size={22} />
        </button>
      </div>

      {warning && <div className="alert alert-note">{warning}</div>}
      {loadError && <div className="alert alert-error">{loadError}</div>}

      {loading ? (
        <div className="empty">טוען...</div>
      ) : view === 'calendar' ? (
        <AppointmentsCalendarView appointments={appointments} onEdit={openEditForm} onDelete={handleDelete} />
      ) : upcomingAppointments.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <CalendarIcon size={24} />
          </span>
          <span className="empty-title">אין תורים קרובים</span>
          <span>הוסיפי תור חדש כדי להתחיל</span>
        </div>
      ) : (
        <div className="section">
          {groupByDay(upcomingAppointments).map((group) => (
            <Fragment key={group.key}>
              <div className="day-label">{group.label}</div>
              <ul className="stack">
                {group.items.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onEdit={openEditForm}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </Fragment>
          ))}
        </div>
      )}

      {showForm && (
        <AppointmentForm appointment={editingAppointment} onSaved={handleSaved} onCancel={closeForm} />
      )}
    </main>
  )
}

export default AppointmentsPage

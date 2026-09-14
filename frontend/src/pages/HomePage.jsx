import { useEffect, useState } from 'react'
import { deleteAppointment, getAppointments } from '../api/appointmentsApi'
import { getCustomers } from '../api/customersApi'
import AppointmentForm from '../components/AppointmentForm'
import AppointmentRow from '../components/AppointmentRow'
import SettingsSheet from '../components/SettingsSheet'
import { CalendarIcon, ChevronLeftIcon, GearIcon, PlusIcon, SparkIcon } from '../components/Icons'

const OWNER_NAME = 'גלי'

function toDateKey(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function greetingForHour(hour) {
  if (hour < 12) return 'בוקר טוב'
  if (hour < 17) return 'צהריים טובים'
  if (hour < 21) return 'ערב טוב'
  return 'לילה טוב'
}

function HomePage({ onNavigate, username, onLogout }) {
  const [appointments, setAppointments] = useState([])
  const [customerCount, setCustomerCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [warning, setWarning] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const [appointmentData, customerData] = await Promise.all([getAppointments(), getCustomers()])
      setAppointments(appointmentData)
      setCustomerCount(customerData.length)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
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
    await loadData()
  }

  async function handleDelete(appointment) {
    if (!window.confirm(`למחוק את התור של ${appointment.customer_name}?`)) return
    try {
      await deleteAppointment(appointment.id)
      await loadData()
    } catch (err) {
      window.alert(err.message)
    }
  }

  const now = new Date()
  const todayKey = toDateKey(now)
  const todayAppointments = appointments.filter((a) => a.appointment_datetime.slice(0, 10) === todayKey)
  const upcomingAppointments = appointments
    .filter((a) => a.appointment_datetime.slice(0, 10) > todayKey)
    .slice(0, 3)
  const monthPrefix = todayKey.slice(0, 7)
  const monthCount = appointments.filter((a) => a.appointment_datetime.slice(0, 7) === monthPrefix).length

  const todayLabel = now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main className="page">
      <header className="greeting">
        <div>
          <h1 className="greeting-title">
            {greetingForHour(now.getHours())}, {OWNER_NAME}
          </h1>
          <p className="greeting-sub">{todayLabel}</p>
        </div>
        <div className="greeting-side">
          <img className="greeting-logo" src="/logo.png" alt="גלי לק ג'יל" width="56" height="56" />
          <button type="button" className="icon-btn" aria-label="הגדרות" onClick={() => setShowSettings(true)}>
            <GearIcon size={18} />
          </button>
        </div>
      </header>

      <section className="stat-card" aria-label="סיכום">
        <div className="stat-card-top">
          <div>
            <div className="stat-label">התורים שלך היום</div>
            <div className="stat-hero">
              {todayAppointments.length}
              <span className="stat-hero-unit">{todayAppointments.length === 1 ? 'תור' : 'תורים'}</span>
            </div>
          </div>
          <span className="stat-badge">
            <SparkIcon size={22} />
          </span>
        </div>
        <div className="stat-row">
          <div>
            <div className="stat-item-label">החודש</div>
            <div className="stat-item-value">{monthCount}</div>
          </div>
          <div>
            <div className="stat-item-label">לקוחות</div>
            <div className="stat-item-value">{customerCount ?? '—'}</div>
          </div>
          <div>
            <div className="stat-item-label">סה״כ תורים</div>
            <div className="stat-item-value">{appointments.length}</div>
          </div>
        </div>
      </section>

      {warning && <div className="alert alert-note">{warning}</div>}
      {loadError && <div className="alert alert-error">{loadError}</div>}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">התורים שלך היום</h2>
          <button type="button" className="section-link" onClick={() => onNavigate('appointments')}>
            הכל
            <ChevronLeftIcon size={15} />
          </button>
        </div>

        {loading ? (
          <div className="empty">טוען...</div>
        ) : todayAppointments.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <CalendarIcon size={24} />
            </span>
            <span className="empty-title">אין תורים היום</span>
            <span>זה הזמן לנשום רגע — או לקבוע תור חדש</span>
          </div>
        ) : (
          <ul className="stack">
            {todayAppointments.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                onEdit={openEditForm}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </section>

      {!loading && upcomingAppointments.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">התורים הקרובים</h2>
          </div>
          <ul className="stack">
            {upcomingAppointments.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                showDate
                onEdit={openEditForm}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        </section>
      )}

      <button type="button" className="btn btn-primary btn-block" onClick={openAddForm}>
        <PlusIcon size={19} />
        תור חדש
      </button>

      {showForm && (
        <AppointmentForm appointment={editingAppointment} onSaved={handleSaved} onCancel={closeForm} />
      )}

      {showSettings && (
        <SettingsSheet username={username} onLogout={onLogout} onClose={() => setShowSettings(false)} />
      )}
    </main>
  )
}

export default HomePage

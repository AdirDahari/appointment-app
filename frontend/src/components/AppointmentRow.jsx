import StatusBadge from './StatusBadge'
import { PencilIcon, TrashIcon } from './Icons'

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

function formatShortDate(isoString) {
  return new Date(isoString).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
}

function AppointmentRow({ appointment, onEdit, onDelete, showDate = false }) {
  const hasReminder = Boolean(appointment.reminder_sent_at)

  return (
    <li className="row-card">
      <div className="appt-time">
        {formatTime(appointment.appointment_datetime)}
        {showDate && <div className="row-meta">{formatShortDate(appointment.appointment_datetime)}</div>}
      </div>

      <div className="row-main">
        <span className="row-name">{appointment.customer_name}</span>
        <span className="row-meta">
          {appointment.appointment_type && <span>{appointment.appointment_type}</span>}
          {hasReminder && <StatusBadge status={appointment.status} />}
        </span>
      </div>

      <div className="row-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label={`עריכת התור של ${appointment.customer_name}`}
          onClick={() => onEdit(appointment)}
        >
          <PencilIcon size={17} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          aria-label={`מחיקת התור של ${appointment.customer_name}`}
          onClick={() => onDelete(appointment)}
        >
          <TrashIcon size={17} />
        </button>
      </div>
    </li>
  )
}

export default AppointmentRow

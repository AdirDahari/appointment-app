import StatusBadge from './StatusBadge'
import { PencilIcon, ShareIcon, TrashIcon } from './Icons'
import { canShare, whatsAppShareUrl } from '../utils/shareAppointment'

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
        <div className="appt-time-end">עד {formatTime(appointment.appointment_end_datetime)}</div>
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
        {canShare(appointment) && (
          <a
            className="icon-btn"
            href={whatsAppShareUrl(appointment)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`שליחת פרטי התור ל${appointment.customer_name} בוואטסאפ`}
          >
            <ShareIcon size={17} />
          </a>
        )}
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

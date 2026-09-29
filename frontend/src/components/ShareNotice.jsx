import { CheckCircleIcon, ShareIcon } from './Icons'
import { whatsAppShareUrl } from '../utils/shareAppointment'

function formatWhen(isoString) {
  const date = new Date(isoString)
  const day = date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${time}`
}

// Pops up right after an appointment is booked or moved: one tap opens the
// customer's WhatsApp chat with the details and the "add to calendar" link.
function ShareNotice({ appointment, isNew, onClose }) {
  const firstName = appointment.customer_name.split(' ')[0]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet share-sheet" onClick={(event) => event.stopPropagation()}>
        <span className="sheet-handle" aria-hidden="true" />
        <span className="share-sheet-icon">
          <CheckCircleIcon size={30} />
        </span>
        <div>
          <h2 className="sheet-title">{isNew ? 'התור נשמר' : 'התור עודכן'}</h2>
          <p className="share-sheet-when">
            {appointment.customer_name} · {formatWhen(appointment.appointment_datetime)}
          </p>
        </div>
        <p className="share-sheet-text">לשלוח ל{firstName} את פרטי התור ולינק להוספה ליומן?</p>
        <div className="form-actions">
          <a
            className="btn btn-whatsapp btn-block"
            href={whatsAppShareUrl(appointment)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
          >
            <ShareIcon size={19} />
            שליחה בוואטסאפ
          </a>
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShareNotice

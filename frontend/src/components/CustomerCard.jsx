import { useEffect, useState } from 'react'
import { getCustomer } from '../api/customersApi'
import { initialsOf } from '../utils/initials'
import { PencilIcon, TrashIcon } from './Icons'

function formatDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function CustomerCard({ customer, onEdit, onDelete }) {
  const [lastAppointmentDate, setLastAppointmentDate] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    getCustomer(customer.id)
      .then((detail) => {
        if (!cancelled) setLastAppointmentDate(detail.last_appointment_date)
      })
      .catch(() => {
        if (!cancelled) setLastAppointmentDate(null)
      })
    return () => {
      cancelled = true
    }
  }, [customer.id])

  let lastAppointmentLabel = 'טוען תור אחרון...'
  if (lastAppointmentDate !== undefined) {
    lastAppointmentLabel = lastAppointmentDate
      ? `תור אחרון: ${formatDate(lastAppointmentDate)}`
      : 'אין תורים קודמים'
  }

  return (
    <li className="row-card">
      <span className="avatar" aria-hidden="true">
        {initialsOf(customer.full_name)}
      </span>

      <div className="row-main">
        <span className="row-name">{customer.full_name}</span>
        <span className="row-meta">{customer.phone_number}</span>
        <span className="row-meta">{lastAppointmentLabel}</span>
      </div>

      <div className="row-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label={`עריכת ${customer.full_name}`}
          onClick={() => onEdit(customer)}
        >
          <PencilIcon size={17} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          aria-label={`מחיקת ${customer.full_name}`}
          onClick={() => onDelete(customer)}
        >
          <TrashIcon size={17} />
        </button>
      </div>
    </li>
  )
}

export default CustomerCard

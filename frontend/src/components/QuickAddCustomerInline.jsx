import { useState } from 'react'
import { createCustomer } from '../api/customersApi'

function QuickAddCustomerInline({ initialName, onCreated, onCancel }) {
  const [fullName, setFullName] = useState(initialName ?? '')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const customer = await createCustomer({ full_name: fullName.trim(), phone_number: phoneNumber.trim() })
      onCreated(customer)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <form className="quick-add-inline" onSubmit={handleSubmit}>
      <h3 className="quick-add-title">לקוח חדש</h3>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label htmlFor="quick_full_name">שם מלא</label>
        <input
          id="quick_full_name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="quick_phone_number">טלפון</label>
        <input
          id="quick_phone_number"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          placeholder="050-0000000"
          required
          inputMode="tel"
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          ביטול
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'שומר...' : 'הוספה'}
        </button>
      </div>
    </form>
  )
}

export default QuickAddCustomerInline

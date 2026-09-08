import { useState } from 'react'

function CustomerForm({ initialValues, onSubmit, onCancel }) {
  const [fullName, setFullName] = useState(initialValues?.full_name ?? '')
  const [phoneNumber, setPhoneNumber] = useState(initialValues?.phone_number ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isEdit = Boolean(initialValues)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({ full_name: fullName.trim(), phone_number: phoneNumber.trim() })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-sheet" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <span className="sheet-handle" aria-hidden="true" />
        <h2 className="sheet-title">{isEdit ? 'עריכת לקוח' : 'לקוח חדש'}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="full_name">שם מלא</label>
          <input
            id="full_name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="למשל: מיכל כהן"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="phone_number">טלפון</label>
          <input
            id="phone_number"
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
            {submitting ? 'שומר...' : 'שמירה'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CustomerForm

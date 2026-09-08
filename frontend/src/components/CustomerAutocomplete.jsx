import { useEffect, useState } from 'react'
import { getCustomers } from '../api/customersApi'
import { initialsOf } from '../utils/initials'

function CustomerAutocomplete({ value, onChange, onSelect }) {
  const [results, setResults] = useState([])

  useEffect(() => {
    if (!value.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    const timeoutId = setTimeout(() => {
      getCustomers(value.trim())
        .then((data) => {
          if (!cancelled) setResults(data)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [value])

  return (
    <div>
      <input
        className="autocomplete-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="שם הלקוח..."
        aria-label="חיפוש לקוח"
        autoFocus
      />
      {results.length > 0 && (
        <ul className="autocomplete-results">
          {results.map((customer) => (
            <li key={customer.id}>
              <button type="button" className="autocomplete-result" onClick={() => onSelect(customer)}>
                <span className="avatar-sm" aria-hidden="true">
                  {initialsOf(customer.full_name)}
                </span>
                <span className="autocomplete-result-name">{customer.full_name}</span>
                <span className="autocomplete-result-phone">{customer.phone_number}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CustomerAutocomplete

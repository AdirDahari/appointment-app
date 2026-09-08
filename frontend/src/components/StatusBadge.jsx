const STATUS_LABELS = {
  pending: 'ממתין',
  confirmed: 'אושר',
  cancelled: 'בוטל',
}

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] ?? status
  return (
    <span className={`chip chip-${status}`}>
      <span className="chip-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

export default StatusBadge

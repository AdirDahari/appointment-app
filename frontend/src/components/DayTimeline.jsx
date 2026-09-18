import { useEffect, useMemo, useRef } from 'react'

// Google-Calendar-style day view used inside the appointment form: existing
// appointments render as blocks on an hour grid, tapping an empty spot picks
// that time (rounded to STEP_MINUTES). Times are 'HH:MM' strings, all in the
// business's local day, so no Date/timezone math is needed here.

const HOUR_HEIGHT = 56 // px per hour
const STEP_MINUTES = 15
const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 21
const LABEL_WIDTH = 52 // px reserved for the hour labels

export function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function toTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function DayTimeline({ appointments, selectedTime, onSelect, durationMinutes, previewLabel }) {
  const scrollRef = useRef(null)
  const gridRef = useRef(null)

  const { startHour, endHour } = useMemo(() => {
    let start = DEFAULT_START_HOUR
    let end = DEFAULT_END_HOUR
    for (const appointment of appointments) {
      const from = toMinutes(appointment.time)
      start = Math.min(start, Math.floor(from / 60))
      end = Math.max(end, Math.ceil((from + durationMinutes) / 60))
    }
    if (selectedTime) {
      const from = toMinutes(selectedTime)
      start = Math.min(start, Math.floor(from / 60))
      end = Math.max(end, Math.ceil((from + durationMinutes) / 60))
    }
    return { startHour: start, endHour: end }
  }, [appointments, selectedTime, durationMinutes])

  const totalHeight = (endHour - startHour) * HOUR_HEIGHT
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  function topOf(time) {
    return ((toMinutes(time) - startHour * 60) / 60) * HOUR_HEIGHT
  }

  // Scroll so the selected time (or the first appointment, or 09:00) is near the top.
  useEffect(() => {
    const anchor = selectedTime || appointments[0]?.time || '09:00'
    const target = Math.max(0, topOf(anchor) - HOUR_HEIGHT / 2)
    if (scrollRef.current) scrollRef.current.scrollTop = target
    // Only on mount / day change: re-scrolling on every tap would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments])

  function handleClick(event) {
    const rect = gridRef.current.getBoundingClientRect()
    const y = event.clientY - rect.top
    const rawMinutes = startHour * 60 + (y / HOUR_HEIGHT) * 60
    const maxStart = endHour * 60 - STEP_MINUTES
    const snapped = Math.min(maxStart, Math.max(startHour * 60, Math.round(rawMinutes / STEP_MINUTES) * STEP_MINUTES))
    onSelect(toTime(snapped))
  }

  const blockHeight = (durationMinutes / 60) * HOUR_HEIGHT - 2

  return (
    <div className="tl-scroll" ref={scrollRef}>
      <div
        className="tl-grid"
        ref={gridRef}
        style={{ height: totalHeight }}
        onClick={handleClick}
        role="group"
        aria-label="בחירת שעה על ציר היום"
      >
        {hours.map((hour) => (
          <div key={hour} className="tl-hour" style={{ top: (hour - startHour) * HOUR_HEIGHT }}>
            <span className="tl-hour-label">{String(hour).padStart(2, '0')}:00</span>
            <span className="tl-hour-line" />
          </div>
        ))}

        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            className="tl-block"
            style={{ top: topOf(appointment.time), height: blockHeight, insetInlineStart: LABEL_WIDTH }}
          >
            <span className="tl-block-time">{appointment.time}</span>
            <span className="tl-block-name">{appointment.customer_name}</span>
            {appointment.appointment_type && <span className="tl-block-type">{appointment.appointment_type}</span>}
          </div>
        ))}

        {selectedTime && (
          <div
            className="tl-block is-new"
            style={{ top: topOf(selectedTime), height: blockHeight, insetInlineStart: LABEL_WIDTH }}
          >
            <span className="tl-block-time">{selectedTime}</span>
            <span className="tl-block-name">{previewLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default DayTimeline

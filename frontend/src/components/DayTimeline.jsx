import { useEffect, useRef } from 'react'

// Google-Calendar-style day view used inside the appointment form: existing
// appointments render as blocks on an hour grid, tapping an empty spot picks
// that start time (rounded to STEP_MINUTES). Times are 'HH:MM' strings, all in
// the business's local day, so no Date/timezone math is needed here.
//
// The grid covers the whole day: appointments can be booked at any hour
// (business hours only decide when WhatsApp reminders go out). It opens
// scrolled to the working part of the day.

const HOUR_HEIGHT = 56 // px per hour
const STEP_MINUTES = 15
const DAY_START_HOUR = 0
const DAY_END_HOUR = 24
const MIN_BLOCK_MINUTES = 20 // keeps very short appointments readable
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

function heightOf(minutes) {
  return (Math.max(minutes, MIN_BLOCK_MINUTES) / 60) * HOUR_HEIGHT - 2
}

// appointments: [{ id, time, endTime, durationMinutes, customer_name, appointment_type }]
function DayTimeline({ appointments, selectedTime, selectedEndTime, selectedMinutes, onSelect, previewLabel }) {
  const scrollRef = useRef(null)
  const gridRef = useRef(null)
  // A time picked by tapping the grid is already on screen, so it must not
  // trigger the follow-scroll below. Holds the last tapped time until then.
  const tappedTimeRef = useRef(null)
  const previousTimeRef = useRef(selectedTime)

  const startHour = DAY_START_HOUR
  const endHour = DAY_END_HOUR

  const totalHeight = (endHour - startHour) * HOUR_HEIGHT
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  function topOf(time) {
    return ((toMinutes(time) - startHour * 60) / 60) * HOUR_HEIGHT
  }

  function scrollToTime(time, behavior) {
    const top = Math.max(0, topOf(time) - HOUR_HEIGHT / 2)
    // Next frame: the sheet may still be laying out when this runs.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top, behavior })
    })
  }

  // On open / day change: jump to the selected time, the first appointment,
  // or opening time.
  useEffect(() => {
    scrollToTime(selectedTime || appointments[0]?.time || '08:00', 'auto')
    // Only on mount / day change: re-scrolling on every tap would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments])

  // Start time changed in the time field: bring it into view.
  useEffect(() => {
    if (selectedTime === previousTimeRef.current) return
    previousTimeRef.current = selectedTime
    if (!selectedTime) return
    if (selectedTime === tappedTimeRef.current) {
      tappedTimeRef.current = null
      return
    }
    scrollToTime(selectedTime, 'smooth')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTime])

  function handleClick(event) {
    const rect = gridRef.current.getBoundingClientRect()
    const y = event.clientY - rect.top
    const rawMinutes = startHour * 60 + (y / HOUR_HEIGHT) * 60
    const maxStart = endHour * 60 - STEP_MINUTES
    const snapped = Math.min(maxStart, Math.max(startHour * 60, Math.round(rawMinutes / STEP_MINUTES) * STEP_MINUTES))
    const time = toTime(snapped)
    tappedTimeRef.current = time === selectedTime ? null : time
    onSelect(time)
  }

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
            style={{
              top: topOf(appointment.time),
              height: heightOf(appointment.durationMinutes),
              insetInlineStart: LABEL_WIDTH,
            }}
          >
            <span className="tl-block-time">
              {appointment.time}–{appointment.endTime}
            </span>
            <span className="tl-block-name">{appointment.customer_name}</span>
            {appointment.appointment_type && <span className="tl-block-type">{appointment.appointment_type}</span>}
          </div>
        ))}

        {selectedTime && (
          <div
            className="tl-block is-new"
            style={{ top: topOf(selectedTime), height: heightOf(selectedMinutes), insetInlineStart: LABEL_WIDTH }}
          >
            <span className="tl-block-time">
              {selectedEndTime ? `${selectedTime}–${selectedEndTime}` : selectedTime}
            </span>
            <span className="tl-block-name">{previewLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default DayTimeline

import { useEffect, useState } from 'react'
import { getPushConfig, sendTestPush, subscribePush, unsubscribePush } from '../api/pushApi'
import { BellIcon } from './Icons'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
const browserSupports = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return { registration: null, subscription: null }
  return { registration, subscription: await registration.pushManager.getSubscription() }
}

function NotificationSettings() {
  const [config, setConfig] = useState(null)
  const [subscribed, setSubscribed] = useState(false)
  const [hasWorker, setHasWorker] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPushConfig()
      .then((data) => {
        if (!cancelled) setConfig(data)
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false })
      })
    if (browserSupports) {
      currentSubscription()
        .then(({ registration, subscription }) => {
          if (cancelled) return
          setHasWorker(Boolean(registration))
          setSubscribed(Boolean(subscription))
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { registration } = await currentSubscription()
      if (!registration) throw new Error('ההתראות זמינות רק באפליקציה המותקנת (לא בשרת הפיתוח)')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('לא ניתנה הרשאה להתראות. אפשר לשנות בהגדרות הטלפון')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.public_key),
      })
      await subscribePush(subscription.toJSON())
      setSubscribed(true)
      setMessage('ההתראות הופעלו במכשיר הזה')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { subscription } = await currentSubscription()
      if (subscription) {
        await unsubscribePush(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setSubscribed(false)
      setMessage('ההתראות כובו במכשיר הזה')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await sendTestPush()
      setMessage('נשלחה התראת בדיקה')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  let status
  if (!browserSupports || (isIos && !isStandalone)) {
    status = 'כדי לקבל התראות באייפון יש להוסיף את האפליקציה למסך הבית (שיתוף ← הוסף למסך הבית) ולפתוח אותה משם'
  } else if (config && !config.enabled) {
    status = 'ההתראות אינן מוגדרות בשרת (חסרים מפתחות VAPID)'
  } else if (!hasWorker) {
    status = 'ההתראות זמינות רק בגרסה המותקנת של האפליקציה'
  }

  const canToggle = browserSupports && config?.enabled && hasWorker && !(isIos && !isStandalone)

  return (
    <section className="settings-block">
      <div className="settings-head">
        <span className="settings-icon">
          <BellIcon size={18} />
        </span>
        <div>
          <div className="settings-title">התראות</div>
          <div className="settings-sub">הודעה לטלפון כשלקוחה מאשרת או מבטלת תור</div>
        </div>
      </div>

      {status && <p className="settings-note">{status}</p>}
      {message && <div className="alert alert-note">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {canToggle && (
        <div className="form-actions">
          {subscribed ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={disable} disabled={busy}>
                כיבוי התראות
              </button>
              <button type="button" className="btn btn-primary" onClick={sendTest} disabled={busy}>
                שליחת בדיקה
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={enable} disabled={busy}>
              {busy ? 'רגע...' : 'הפעלת התראות במכשיר הזה'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default NotificationSettings

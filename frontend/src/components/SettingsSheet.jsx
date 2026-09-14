import NotificationSettings from './NotificationSettings'
import { LogoutIcon } from './Icons'

function SettingsSheet({ username, onLogout, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
        <span className="sheet-handle" aria-hidden="true" />
        <h2 className="sheet-title">הגדרות</h2>

        <NotificationSettings />

        <section className="settings-block">
          <div className="settings-head">
            <span className="settings-icon">
              <LogoutIcon size={18} />
            </span>
            <div>
              <div className="settings-title">חשבון</div>
              <div className="settings-sub">מחוברת בתור {username}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              if (window.confirm('להתנתק מהאפליקציה במכשיר הזה?')) onLogout()
            }}
          >
            התנתקות
          </button>
        </section>

        <div className="form-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            סגירה
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsSheet

import { useEffect, useState } from 'react'
import { logout, refreshSession } from './api/authApi'
import { AUTH_LOGOUT_EVENT, getToken } from './api/http'
import AppointmentsPage from './pages/AppointmentsPage'
import CustomersPage from './pages/CustomersPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import { CalendarIcon, HomeIcon, UsersIcon } from './components/Icons'

// Standalone, intentionally unlinked page — reachable only by opening this exact
// URL directly (it is referenced from Meta's app settings, not from the UI).
const PRIVACY_POLICY_PATH = '/privacy-policy'

const TABS = [
  { key: 'home', label: 'בית', Icon: HomeIcon },
  { key: 'appointments', label: 'תורים', Icon: CalendarIcon },
  { key: 'customers', label: 'לקוחות', Icon: UsersIcon },
]

function App() {
  const [activeTab, setActiveTab] = useState('home')
  // undefined = still checking the stored session, null = logged out
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    if (!getToken()) {
      setSession(null)
      return
    }
    refreshSession()
      .then(setSession)
      .catch((err) => {
        // 401 means the token is dead. Anything else (offline, server down)
        // keeps the owner in: the pages will show their own error and the
        // token is retried on next launch.
        setSession(err.status === 401 ? null : { username: '' })
      })

    const handleLogout = () => setSession(null)
    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout)
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout)
  }, [])

  function handleLogout() {
    logout()
    setSession(null)
    setActiveTab('home')
  }

  if (window.location.pathname.replace(/\/+$/, '') === PRIVACY_POLICY_PATH) {
    return <PrivacyPolicyPage />
  }

  if (session === undefined) {
    return <main className="page splash">טוען...</main>
  }

  if (session === null) {
    return <LoginPage onLoggedIn={setSession} />
  }

  return (
    <>
      {activeTab === 'home' && (
        <HomePage onNavigate={setActiveTab} username={session.username} onLogout={handleLogout} />
      )}
      {activeTab === 'appointments' && <AppointmentsPage />}
      {activeTab === 'customers' && <CustomersPage />}

      <nav className="bottom-nav">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`nav-item${activeTab === key ? ' active' : ''}`}
            aria-current={activeTab === key ? 'page' : undefined}
            onClick={() => setActiveTab(key)}
          >
            <span className="nav-icon">
              <Icon size={21} />
            </span>
            {label}
          </button>
        ))}
      </nav>
    </>
  )
}

export default App

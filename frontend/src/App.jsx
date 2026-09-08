import { useState } from 'react'
import AppointmentsPage from './pages/AppointmentsPage'
import CustomersPage from './pages/CustomersPage'
import HomePage from './pages/HomePage'
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

  if (window.location.pathname.replace(/\/+$/, '') === PRIVACY_POLICY_PATH) {
    return <PrivacyPolicyPage />
  }

  return (
    <>
      {activeTab === 'home' && <HomePage onNavigate={setActiveTab} />}
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

import { useState } from 'react'
import { login } from '../api/authApi'

function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const session = await login(username.trim(), password)
      onLoggedIn(session)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img className="login-logo" src="/logo.png" alt="גלי לק ג'יל" width="88" height="88" />
        <h1 className="login-title">ניהול תורים</h1>
        <p className="login-sub">התחברי כדי להמשיך</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="login_username">שם משתמש</label>
          <input
            id="login_username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="login_password">סיסמה</label>
          <input
            id="login_password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'מתחברת...' : 'התחברות'}
        </button>
        <p className="login-hint">ההתחברות נשמרת במכשיר הזה — אין צורך להתחבר שוב בכל פתיחה</p>
      </form>
    </main>
  )
}

export default LoginPage

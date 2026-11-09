import { useState } from 'react';

export default function AuthPage({ onLogin, onNewUser, onBack }) {
  const [isRegistering, setIsRegistering] = useState(
    () => localStorage.getItem('logicade_auth_mode') === 'register',
  );
  const [username, setUsername] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setUsername('');
    setStudentNumber('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setNotice('');
  };

  const handleToggleMode = () => {
    const nextMode = !isRegistering;
    setIsRegistering(nextMode);
    localStorage.setItem('logicade_auth_mode', nextMode ? 'register' : 'login');
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!(isRegistering ? username.trim() && studentNumber.trim() : studentNumber.trim()) || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (!isRegistering && studentNumber.trim().toLowerCase() === 'admin' && password === 'logicade') {
      sessionStorage.removeItem('logicade_admin_session');
      window.location.assign('/admin/');
      return;
    }

    if (isRegistering) {
      if (!/^[A-Za-z0-9_.-]{3,40}$/.test(username.trim())) {
        setError('Username must be 3–40 characters and use only letters, numbers, dots, hyphens, or underscores.');
        return;
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/.test(studentNumber.trim())) {
        setError('Student number must be 3–40 characters and contain only letters, numbers, or hyphens.');
        return;
      }
      if (password.length < 8 || password.length > 256) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }
    setBusy(true);
    try {
      let response = await fetch(`/api/auth/${isRegistering ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRegistering
          ? { username: username.trim(), student_number: studentNumber.trim().toUpperCase(), password }
          : { student_number: studentNumber.trim().toUpperCase(), password }),
      });
      const responseText = await response.text();
      let result = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        // Static servers and proxy errors can return HTML or plain text instead
        // of FastAPI's JSON response. Keep the status visible for diagnosis.
      }
      if (!response.ok) {
        const detail = Array.isArray(result.detail)
          ? result.detail.map((item) => item.msg || JSON.stringify(item)).join('; ')
          : result.detail;
        if (detail) throw new Error(detail);
        if (response.status === 404 || response.status === 501) {
          throw new Error(
            `Account API returned HTTP ${response.status}. This request may not have reached FastAPI; use the Vite address and keep FastAPI running on port 8000.`,
          );
        }
        throw new Error(`Account request failed (HTTP ${response.status}). Check the FastAPI terminal for the matching request.`);
      }
      if (!result.student_id || (!isRegistering && !result.token)) {
        throw new Error(
          `The account server returned an unexpected response (HTTP ${response.status}). Check the Vite proxy and FastAPI terminal.`,
        );
      }
      if (isRegistering) {
        onNewUser(result.student_id);
        localStorage.removeItem('logicade_session_token');
        localStorage.removeItem('logicade_current_user');
        localStorage.setItem('logicade_auth_mode', 'login');
        setIsRegistering(false);
        setPassword('');
        setConfirmPassword('');
        setNotice('Account created. Please log in with your student number and password.');
        return;
      }
      localStorage.setItem('logicade_session_token', result.token);
      localStorage.setItem('logicade_username', result.username);
      const savedAvatar = localStorage.getItem(`logicade_avatar_${result.student_id}`);
      if (savedAvatar) {
        localStorage.setItem('logicade_avatar', savedAvatar);
      } else {
        localStorage.removeItem('logicade_avatar');
      }
      onLogin(result.student_id);
    } catch (err) {
      setError(err.message || 'Could not reach the account server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-container realm-auth-screen">
      <div className="realm-auth-layout">
        <aside className="realm-auth-brand">
          <img src="/assets/logicade_logo.png" alt="LogiCade" />
          <div className="realm-divider" aria-hidden="true" />
          <p>{isRegistering ? 'Join LogiCade and begin your coding adventure' : 'Log in to continue your adventure'}</p>
        </aside>

        <section className="realm-paper realm-auth-form" aria-labelledby="account-title">
          <button type="button" className="realm-auth-back" onClick={onBack} disabled={busy}>← Back</button>
          <h1 id="account-title" className="realm-heading">{isRegistering ? 'Create Your Account' : 'Welcome Back!'}</h1>
          <div className="realm-divider" aria-hidden="true" />
          {error && <p className="realm-form-error" role="alert">{error}</p>}
          {notice && <p className="auth-success" role="status">{notice}</p>}

          <form className="realm-fields" onSubmit={handleSubmit}>
            {isRegistering && (
              <label className="realm-field">
                <span>Username</span>
                <input type="text" placeholder="Choose a username" value={username}
                  onChange={(event) => setUsername(event.target.value)} autoComplete="off" maxLength={40} required />
              </label>
            )}
            <label className="realm-field">
              <span>Student Number</span>
              <input type="text" placeholder="Enter your student number" value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)} autoComplete="username"
                autoCapitalize="characters" maxLength={40} required />
            </label>
            <label className="realm-field">
              <span>Password</span>
              <input type="password" placeholder="Enter your password" value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegistering ? 'new-password' : 'current-password'} required />
            </label>
            {isRegistering && (
              <label className="realm-field">
                <span>Confirm Password</span>
                <input type="password" placeholder="Re-enter your password" value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
              </label>
            )}
            <button type="submit" className="realm-button realm-button-blue" disabled={busy}>
              {busy ? 'Please wait…' : isRegistering ? 'Register' : 'Login'}
            </button>
          </form>

          <p className="realm-auth-switch">
            {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
            <button type="button" onClick={handleToggleMode} disabled={busy}>{isRegistering ? 'Log in' : 'Register'}</button>
          </p>
        </section>
      </div>
    </main>
  );
}

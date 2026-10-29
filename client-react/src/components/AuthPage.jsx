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
    <div className="auth-container">
      <div className="parchment-wrapper">
        <h2 className="auth-title">
          {isRegistering ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK!'}
        </h2>
        <p className="auth-subtitle">
          {isRegistering
            ? 'Join LogiCade and begin your coding adventure!'
            : 'Log in to continue your adventure.'}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-success" role="status">{notice}</div>}

        <form onSubmit={handleSubmit} style={{ width: '100%' }} autoComplete="off">
          {isRegistering && (
            <div className="input-group">
              <span className="input-icon">👤</span>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                maxLength={40}
                required
              />
            </div>
          )}

          <div className="input-group">
            <span className="input-icon">🪪</span>
            <input
              type="text"
              placeholder="Student Number"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              autoComplete="username"
              autoCapitalize="characters"
              maxLength={40}
              required
            />
          </div>

          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {isRegistering && (
            <div className="input-group">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}

          <button type="submit" className="btn-auth" disabled={busy}>
            {busy ? 'PLEASE WAIT…' : isRegistering ? 'REGISTER' : 'LOGIN'}
          </button>
        </form>

        <div className="auth-toggle">
          {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
          <span onClick={handleToggleMode}>
            {isRegistering ? 'Log in' : 'Register'}
          </span>
        </div>
      </div>
    </div>
  );
}

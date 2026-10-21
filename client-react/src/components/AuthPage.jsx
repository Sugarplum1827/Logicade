import { useState } from 'react';

export default function AuthPage({ onLogin, onNewUser }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const getUsers = () => JSON.parse(localStorage.getItem('logicade_users') || '[]');
  const saveUsers = (users) => localStorage.setItem('logicade_users', JSON.stringify(users));

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleToggleMode = () => {
    setIsRegistering(!isRegistering);
    resetForm();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    const users = getUsers();

    if (isRegistering) {
      // ── REGISTRATION LOGIC ──
      if (!email.trim()) {
        setError("Please provide an email address.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        setError("This username is already in use.");
        return;
      }
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        setError("This email is already used.");
        return;
      }

      // Save user
      users.push({ username, email, password });
      saveUsers(users);

      if (!localStorage.getItem('logicade_coins')) {
        localStorage.setItem('logicade_coins', '50');
      }

      alert("Account created successfully! Please log in.");
      setIsRegistering(false);
      resetForm(); 
      onNewUser(username); // Trigger avatar selection for new user
      
    } else {
      // ── LOGIN LOGIC ──
      const user = users.find(u => 
        u.username.toLowerCase() === username.toLowerCase() || 
        u.email.toLowerCase() === username.toLowerCase()
      );

      if (!user) {
        setError("Account not found. Please register.");
        return;
      }
      if (user.password !== password) {
        setError("Incorrect password.");
        return;
      }

      onLogin(user.username);
    }
  };

  return (
    <div className="auth-container">
      <div className="parchment-wrapper">
        <h2 className="auth-title">{isRegistering ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK!'}</h2>
        <p className="auth-subtitle">
          {isRegistering ? 'Join LogiCade and begin your coding adventure!' : 'Log in to continue your adventure.'}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ width: '100%' }} autoComplete="off">
          
          <div className="input-group">
            <span className="input-icon">👤</span>
            <input 
              type="text" 
              placeholder={isRegistering ? "Username" : "Username or Email"} 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              autoComplete="off"
              required 
            />
          </div>

          {isRegistering && (
            <div className="input-group">
              <span className="input-icon">✉️</span>
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                autoComplete="off"
                required 
              />
            </div>
          )}
          
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

          <button type="submit" className="btn-auth">
            {isRegistering ? 'REGISTER' : 'LOGIN'}
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
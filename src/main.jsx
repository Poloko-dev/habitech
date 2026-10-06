import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { LockScreen } from './components/LockScreen.jsx';
import { authStatus, LOCKED_EVENT } from './lib/auth.js';
import './styles.css';

/** Shows the lock screen until the server confirms a valid PASS_TOKEN session. */
function AuthGate() {
  const [state, setState] = useState({ status: 'checking', configured: true });
  const [session, setSession] = useState(0); // remounts App after each unlock

  useEffect(() => {
    authStatus()
      .then((s) => setState({ status: s.authenticated ? 'unlocked' : 'locked', configured: s.configured }))
      .catch(() => setState({ status: 'locked', configured: true }));
    const onLocked = () => setState((s) => ({ ...s, status: 'locked' }));
    window.addEventListener(LOCKED_EVENT, onLocked);
    return () => window.removeEventListener(LOCKED_EVENT, onLocked);
  }, []);

  if (state.status === 'checking') return null;
  if (state.status === 'locked') {
    return (
      <LockScreen configured={state.configured} onUnlocked={() => {
        setSession((n) => n + 1);
        setState((s) => ({ ...s, status: 'unlocked' }));
      }} />
    );
  }
  return <App key={session} />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
);

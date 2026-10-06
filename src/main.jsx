import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { LockScreen } from './components/LockScreen.jsx';
import { authStatus, LOCKED_EVENT } from './lib/auth.js';
import './styles.css';

/** Shows the lock screen (or first-launch token setup) until the server confirms a session. */
function AuthGate() {
  const [state, setState] = useState({ status: 'checking', setupRequired: false, error: '' });
  const [session, setSession] = useState(0); // remounts App after each unlock

  const check = useCallback(() => {
    authStatus()
      .then((s) => setState({ status: s.authenticated ? 'unlocked' : 'locked', setupRequired: s.setupRequired, error: '' }))
      .catch((err) => {
        // e.g. MongoDB isn't running – show the server's message instead of a token form.
        setState({ status: 'locked', setupRequired: false, error: err.message || 'Can’t reach the server.' });
      });
  }, []);

  useEffect(() => {
    check();
    const onLocked = () => check();
    window.addEventListener(LOCKED_EVENT, onLocked);
    return () => window.removeEventListener(LOCKED_EVENT, onLocked);
  }, [check]);

  if (state.status === 'checking') return null;
  if (state.status === 'locked') {
    return (
      <LockScreen setupRequired={state.setupRequired} statusError={state.error} onRetry={check}
        onUnlocked={() => {
          setSession((n) => n + 1);
          setState({ status: 'unlocked', setupRequired: false, error: '' });
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyLocked } from './auth.js';

const API = '/api/storage';
const SAVE_DELAY_MS = 400;

/**
 * Loads storage.json via the API and persists every change back to it
 * (debounced). `update` takes a function (data) => newData.
 */
export function useStore() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | saved | saving | error
  const [error, setError] = useState(null);
  const timer = useRef(null);
  const latest = useRef(null);

  useEffect(() => {
    fetch(API)
      .then(async (r) => {
        if (r.status === 401) {
          notifyLocked(); // session expired or locked elsewhere
          throw new Error('Locked');
        }
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `Could not load your data (${r.status})`);
        }
        return r.json();
      })
      .then((d) => {
        setData(d);
        setStatus('saved');
      })
      .catch((e) => {
        setError(e.message);
        setStatus('error');
      });
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = null;
    if (!latest.current) return;
    try {
      const r = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latest.current),
      });
      if (r.status === 401) {
        notifyLocked();
        throw new Error('Locked – unlock to save');
      }
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${r.status})`);
      }
      setStatus(timer.current ? 'saving' : 'saved');
      setError(null);
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  }, []);

  const update = useCallback(
    (fn) => {
      setData((prev) => {
        const next = fn(prev);
        latest.current = next;
        return next;
      });
      setStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Don't lose a pending save when the tab closes.
  useEffect(() => {
    const onUnload = () => {
      if (timer.current && latest.current) {
        navigator.sendBeacon?.(API, new Blob([JSON.stringify(latest.current)], { type: 'application/json' }));
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  return { data, update, status, error, retry: flush };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

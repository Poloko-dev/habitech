import { useCallback, useEffect, useRef, useState } from 'react';
import * as P from './pomodoro.js';
import { playSound, unlockAudio } from './sound.js';

const BASE_TITLE = document.title;

/**
 * Runs the Pomodoro timer at app level so it keeps going while you switch pages.
 * Timer state lives in storage.json; the countdown is derived from `endsAt`, so it
 * stays accurate across reloads and background-tab throttling.
 */
export function usePomodoro(data, update) {
  const safe = data ?? { habits: [], logs: {} }; // storage.json may still be loading
  const p = P.getPomodoro(safe);
  const timer = P.currentTimer(safe);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const fired = useRef(null);
  const settingsRef = useRef(p.settings);
  settingsRef.current = p.settings;

  // Tick while running, plus one precise timeout for the end (a single timeout isn't
  // subject to the heavy throttling browsers apply to intervals in hidden tabs).
  useEffect(() => {
    if (!timer.running) return undefined;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 250);
    const end = setTimeout(() => setNow(Date.now()), Math.max(0, timer.endsAt - Date.now()) + 20);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      clearTimeout(end);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [timer.running, timer.endsAt]);

  const left = P.remainingMs(timer, now);

  // Phase finished → alarm, notify, log, advance.
  useEffect(() => {
    if (!timer.running || left > 0 || fired.current === timer.endsAt) return;
    fired.current = timer.endsAt;
    const s = settingsRef.current;
    const mode = P.MODES[timer.mode];
    const missedWhileClosed = Date.now() - timer.endsAt > 60000;
    if (!missedWhileClosed) {
      playSound(timer.mode === 'focus' ? s.focusSound : s.breakSound, s.volume);
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([250, 120, 250]);
      if (s.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try {
          new Notification(mode.done, { body: mode.next, tag: 'habitech-pomodoro' });
        } catch { /* some mobile browsers only allow notifications from a service worker */ }
      }
    }
    setToast({ title: mode.done, body: missedWhileClosed ? 'It finished while the app was closed.' : mode.next, id: timer.endsAt });
    update((d) => P.complete(d, timer.endsAt, Date.now()));
  }, [left, timer.running, timer.endsAt, timer.mode, update]);

  // Auto-hide the toast.
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(t);
  }, [toast]);

  // Countdown in the tab title while running.
  useEffect(() => {
    document.title = timer.running ? `${P.formatClock(left)} · ${P.MODES[timer.mode].label} — Habitech` : BASE_TITLE;
  }, [timer.running, timer.mode, Math.ceil(left / 1000)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { document.title = BASE_TITLE; }, []);

  const start = useCallback(() => {
    unlockAudio(); // must happen inside the click so the alarm is allowed to play later
    const s = settingsRef.current;
    if (s.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    update((d) => P.start(d, Date.now()));
  }, [update]);

  const setSettings = useCallback(async (patch) => {
    if (patch.notify && 'Notification' in window && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') patch = { ...patch, notify: false };
    }
    update((d) => P.setSettings(d, patch));
  }, [update]);

  return {
    settings: p.settings,
    sessions: p.sessions,
    timer,
    remainingMs: left,
    totalMs: timer.durationMin * 60000,
    start,
    pause: useCallback(() => update((d) => P.pause(d, Date.now())), [update]),
    reset: useCallback(() => update((d) => P.reset(d)), [update]),
    skip: useCallback(() => update((d) => P.skip(d)), [update]),
    setMode: useCallback((m) => update((d) => P.setMode(d, m)), [update]),
    setSettings,
    toast,
    dismissToast: () => setToast(null),
  };
}

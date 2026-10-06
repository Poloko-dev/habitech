import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';

/**
 * "⋮" button that opens a small menu of actions.
 * items: [{ label, icon, onSelect, danger }]
 * The menu is position: fixed so it isn't clipped by scrolling table containers,
 * and flips upward when there's no room below.
 */
export function ActionMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: -9999, right: 0 });
  const btn = useRef(null);
  const menu = useRef(null);

  useLayoutEffect(() => {
    if (!open) return;
    const b = btn.current.getBoundingClientRect();
    const m = menu.current.getBoundingClientRect();
    const below = b.bottom + 6;
    const top = below + m.height > window.innerHeight - 8 ? Math.max(8, b.top - m.height - 6) : below;
    setPos({ top, right: Math.max(8, window.innerWidth - b.right) });
    // preventScroll: focusing must not nudge the scrollable table (which would close the menu).
    menu.current.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onDown = (e) => {
      if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        btn.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  // Arrow keys move between items (standard menu behaviour).
  const onMenuKey = (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const all = [...menu.current.querySelectorAll('[role="menuitem"]')];
    const i = all.indexOf(document.activeElement);
    all[(i + step + all.length) % all.length]?.focus({ preventScroll: true });
  };

  return (
    <>
      <button ref={btn} className={`icon-btn kebab ${open ? 'open' : ''}`} aria-label={label} title={label}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="more" size={18} stroke={3} />
      </button>
      {open && (
        <div ref={menu} className="action-menu" role="menu" aria-label={label} onKeyDown={onMenuKey}
          style={{ top: pos.top, right: pos.right }}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" className={it.danger ? 'danger' : ''}
              onClick={() => { setOpen(false); it.onSelect(); }}>
              <Icon name={it.icon} size={16} />{it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

import { useEffect, useRef } from 'react';
export interface MenuItem { label: string; action: () => void; danger?: boolean; disabled?: boolean }
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = () => onClose();
    document.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('resize', close); };
  }, [onClose]);
  return <div ref={ref} role="menu" aria-label="Map context menu" className="map-context-menu" style={{ left: Math.max(8, Math.min(x, window.innerWidth - 240)), top: Math.max(8, Math.min(y, window.innerHeight - items.length * 37 - 24)) }} onPointerDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()} onKeyDown={e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); const buttons = Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }
  }}>{items.map(item => <button key={item.label} role="menuitem" disabled={item.disabled} className={item.danger ? 'danger-text' : ''} onClick={() => { onClose(); item.action(); }}>{item.label}</button>)}</div>;
}

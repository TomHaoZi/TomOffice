import { useEffect } from 'react';
// A small, frame-limited highlight. Never updates React state or touches editor content.
export function useGlassLight(root, enabled) {
  useEffect(() => {
    const node = root.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!node || !enabled) return;
    let frame = 0, point;
    const move = event => {
      if (motion.matches) return;
      const target = event.target instanceof Element && event.target.closest('[data-glass-light]');
      if (!target || !node.contains(target)) return;
      point = { target, x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0; if (!point.target.isConnected) return;
        const bounds = point.target.getBoundingClientRect();
        point.target.style.setProperty('--light-x', `${(point.x - bounds.left) / Math.max(1, bounds.width) * 100}%`);
        point.target.style.setProperty('--light-y', `${(point.y - bounds.top) / Math.max(1, bounds.height) * 100}%`);
      });
    };
    node.addEventListener('pointermove', move, { passive: true });
    return () => { node.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, [root, enabled]);
}

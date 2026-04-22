import { useEffect, useState } from 'react';

/**
 * Reativo a `(prefers-reduced-motion: reduce)`. Retorna `true` quando o
 * usuário pediu para reduzir animações no SO/navegador.
 *
 * Usado em fluxos onde scroll suave, foco animado ou destaques pulsantes
 * podem causar desconforto (vestibular, TDAH, leitores de tela).
 *
 * SSR-safe: assume `false` quando `window` não existe.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

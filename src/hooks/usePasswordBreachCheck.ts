/**
 * usePasswordBreachCheck — verifica se uma senha apareceu em vazamentos
 * usando a API do Have I Been Pwned com k-anonymity (apenas os 5 primeiros
 * caracteres do hash SHA-1 são enviados, preservando privacidade).
 *
 * @example
 *   const { check, loading, breached, count } = usePasswordBreachCheck();
 *   await check(password);
 *   if (breached) toast.error(`Esta senha apareceu em ${count} vazamentos`);
 */
import { useCallback, useState } from "react";

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

interface BreachResult {
  breached: boolean;
  count: number;
}

export function usePasswordBreachCheck() {
  const [loading, setLoading] = useState(false);
  const [breached, setBreached] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (password: string): Promise<BreachResult> => {
    if (!password || password.length < 4) {
      const result = { breached: false, count: 0 };
      setBreached(false);
      setCount(0);
      return result;
    }
    setLoading(true);
    setError(null);
    try {
      const hash = await sha1Hex(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true" },
      });
      if (!res.ok) throw new Error(`HIBP returned ${res.status}`);

      const text = await res.text();
      const lines = text.split(/\r?\n/);
      let foundCount = 0;
      for (const line of lines) {
        const [hashSuffix, occStr] = line.split(":");
        if (hashSuffix?.trim().toUpperCase() === suffix) {
          foundCount = parseInt(occStr ?? "0", 10);
          break;
        }
      }
      const result = { breached: foundCount > 0, count: foundCount };
      setBreached(result.breached);
      setCount(result.count);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao verificar senha";
      setError(msg);
      // Fail-open: don't block user if HIBP is down
      const result = { breached: false, count: 0 };
      setBreached(false);
      setCount(0);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { check, loading, breached, count, error };
}

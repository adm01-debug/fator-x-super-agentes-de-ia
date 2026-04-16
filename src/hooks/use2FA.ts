/**
 * use2FA — TOTP-based two-factor authentication hook.
 * Uses otpauth library for HMAC-SHA1 token generation per RFC 6238.
 */
import { useCallback, useEffect, useState } from "react";
import { TOTP, Secret } from "otpauth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ISSUER = "Fator X";

interface TwoFAState {
  enabled: boolean;
  loading: boolean;
  hasRecord: boolean;
}

export function use2FA() {
  const { user } = useAuth();
  const [state, setState] = useState<TwoFAState>({ enabled: false, loading: true, hasRecord: false });

  useEffect(() => {
    if (!user?.id) { setState({ enabled: false, loading: false, hasRecord: false }); return; }
    (async () => {
      const { data } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { enabled: boolean } | null }> } } } })
        .from("user_2fa").select("enabled").eq("user_id", user.id).maybeSingle();
      setState({ enabled: !!data?.enabled, loading: false, hasRecord: !!data });
    })();
  }, [user?.id]);

  const generateSecret = useCallback(() => {
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({ issuer: ISSUER, label: user?.email ?? "user", secret });
    return { secret: secret.base32, uri: totp.toString() };
  }, [user?.email]);

  const verifyToken = useCallback((secret: string, token: string): boolean => {
    try {
      const totp = new TOTP({ issuer: ISSUER, label: user?.email ?? "user", secret: Secret.fromBase32(secret) });
      const delta = totp.validate({ token: token.replace(/\s/g, ""), window: 1 });
      return delta !== null;
    } catch { return false; }
  }, [user?.email]);

  const enable = useCallback(async (secret: string, token: string) => {
    if (!user?.id) throw new Error("Not authenticated");
    if (!verifyToken(secret, token)) throw new Error("Código inválido");
    const backupCodes = Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 10).toUpperCase());
    const client = supabase as unknown as { from: (t: string) => { upsert: (r: Record<string, unknown>, o?: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } };
    const { error } = await client.from("user_2fa").upsert({
      user_id: user.id, secret, enabled: true, backup_codes: backupCodes, last_verified_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    setState({ enabled: true, loading: false, hasRecord: true });
    return backupCodes;
  }, [user?.id, verifyToken]);

  const disable = useCallback(async () => {
    if (!user?.id) throw new Error("Not authenticated");
    const client = supabase as unknown as { from: (t: string) => { delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } };
    const { error } = await client.from("user_2fa").delete().eq("user_id", user.id);
    if (error) throw new Error(error.message);
    setState({ enabled: false, loading: false, hasRecord: false });
  }, [user?.id]);

  return { ...state, generateSecret, verifyToken, enable, disable };
}

/**
 * TwoFactorSetup — UI for enabling/disabling TOTP 2FA.
 * Shows QR code, accepts verification token, displays backup codes once.
 */
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { use2FA } from "@/hooks/use2FA";
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function TwoFactorSetup() {
  const { enabled, loading, generateSecret, enable, disable } = use2FA();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  function startSetup() {
    setSetup(generateSecret());
    setToken("");
    setBackupCodes(null);
  }

  async function confirmSetup() {
    if (!setup) return;
    setBusy(true);
    try {
      const codes = await enable(setup.secret, token);
      setBackupCodes(codes);
      setSetup(null);
      setToken("");
      toast.success("2FA ativado com sucesso!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar 2FA");
    } finally { setBusy(false); }
  }

  async function handleDisable() {
    setBusy(true);
    try { await disable(); toast.success("2FA desativado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  }

  if (loading) return <Card className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></Card>;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? <ShieldCheck className="w-5 h-5 text-nexus-emerald" /> : <ShieldOff className="w-5 h-5 text-muted-foreground" />}
          <h3 className="text-sm font-bold text-foreground">Autenticação de Dois Fatores (2FA)</h3>
          <Badge variant="outline" className={`text-[10px] ${enabled ? "border-nexus-emerald text-nexus-emerald" : ""}`}>
            {enabled ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Use um app autenticador (Google Authenticator, Authy, 1Password) para gerar códigos de 6 dígitos a cada login.
      </p>

      {backupCodes && (
        <div className="bg-nexus-amber/10 border border-nexus-amber/30 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-nexus-amber">⚠️ Códigos de backup — copie e guarde em local seguro:</p>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
            {backupCodes.map((c) => <code key={c} className="bg-secondary px-2 py-1 rounded">{c}</code>)}
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")); toast.success("Copiados!"); }}>
            <Copy className="w-3 h-3" /> Copiar todos
          </Button>
        </div>
      )}

      {!enabled && !setup && (
        <Button onClick={startSetup} size="sm" className="gap-2"><ShieldCheck className="w-3 h-3" /> Ativar 2FA</Button>
      )}

      {!enabled && setup && (
        <div className="space-y-4 bg-secondary/30 p-4 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-lg"><QRCodeSVG value={setup.uri} size={180} /></div>
            <p className="text-[11px] text-muted-foreground text-center">Escaneie com seu app autenticador, depois insira o código de 6 dígitos abaixo.</p>
            <code className="text-[10px] font-mono text-muted-foreground break-all">{setup.secret}</code>
          </div>
          <div className="flex gap-2">
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="000000" maxLength={6} className="text-center font-mono tracking-widest" />
            <Button onClick={confirmSetup} disabled={busy || token.length !== 6} size="sm">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSetup(null)} className="w-full text-xs">Cancelar</Button>
        </div>
      )}

      {enabled && !backupCodes && (
        <Button onClick={handleDisable} variant="outline" size="sm" disabled={busy} className="gap-2 text-destructive">
          <ShieldOff className="w-3 h-3" /> Desativar 2FA
        </Button>
      )}
    </Card>
  );
}

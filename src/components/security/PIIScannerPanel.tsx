/**
 * PIIScannerPanel — Interactive PII detection and prompt injection scanner.
 * Wires securityGuards lib into the SecurityPage.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Loader2, Eye, AlertTriangle, CheckCircle2, XCircle, Scan } from 'lucide-react';
import { detectAndRedactPII, detectPromptInjection, checkOutputSafety, type PIIDetectionResult, type InjectionDetectionResult } from '@/lib/securityGuards';

const RISK_COLORS: Record<string, string> = {
  none: 'text-nexus-emerald',
  low: 'text-nexus-blue',
  medium: 'text-nexus-amber',
  high: 'text-destructive',
  critical: 'text-destructive',
};

export function PIIScannerPanel() {
  const [text, setText] = useState('');
  const [piiResult, setPiiResult] = useState<PIIDetectionResult | null>(null);
  const [injectionResult, setInjectionResult] = useState<InjectionDetectionResult | null>(null);
  const [outputResult, setOutputResult] = useState<{ safe: boolean; issues: string[] } | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    if (!text.trim()) return;
    setScanning(true);
    setTimeout(() => {
      setPiiResult(detectAndRedactPII(text));
      setInjectionResult(detectPromptInjection(text));
      setOutputResult(checkOutputSafety(text));
      setScanning(false);
    }, 300);
  };

  const allClear = piiResult && !piiResult.hasAnyPII && injectionResult && !injectionResult.isInjection && outputResult?.safe;

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
          <Shield className="h-4 w-4 text-destructive" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">PII Scanner & Injection Detector</h3>
          <p className="text-[11px] text-muted-foreground">Detecta CPF, CNPJ, email, cartão de crédito + prompt injection</p>
        </div>
        <Badge variant="outline" className="ml-auto text-[10px]">LGPD</Badge>
      </div>

      <Textarea
        placeholder="Cole aqui um texto para escanear por PII e prompt injection...&#10;Ex: Meu CPF é 123.456.789-09 e meu email é joao@email.com"
        value={text}
        onChange={e => setText(e.target.value)}
        className="text-sm min-h-[80px]"
      />

      <Button size="sm" className="gap-1.5 text-xs" onClick={handleScan} disabled={scanning || !text.trim()}>
        {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scan className="h-3.5 w-3.5" />}
        Escanear
      </Button>

      {(piiResult || injectionResult) && (
        <div className="space-y-3 animate-fade-in">
          {/* Overall status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${allClear ? 'border-nexus-emerald/30 bg-nexus-emerald/5' : 'border-destructive/30 bg-destructive/5'}`}>
            {allClear ? <CheckCircle2 className="h-5 w-5 text-nexus-emerald" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
            <span className="text-xs font-bold">{allClear ? 'Texto seguro — nenhuma ameaça detectada' : 'Ameaças detectadas!'}</span>
          </div>

          {/* PII Results */}
          {piiResult && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-nexus-amber" />
                <span className="text-xs font-semibold">PII Detection</span>
                <Badge variant={piiResult.hasAnyPII ? 'destructive' : 'secondary'} className="text-[10px]">
                  {piiResult.hasAnyPII ? `${piiResult.detected.length} tipo(s)` : 'Limpo'}
                </Badge>
              </div>
              {piiResult.detected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {piiResult.detected.map((d, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] gap-1 border-destructive/30">
                      {d.type.toUpperCase()} ×{d.count}
                    </Badge>
                  ))}
                </div>
              )}
              {piiResult.hasAnyPII && (
                <div className="rounded-lg bg-secondary/30 p-2.5 mt-2">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">Texto Redactado:</p>
                  <p className="text-[11px] font-mono text-foreground break-words">{piiResult.redactedText}</p>
                </div>
              )}
            </div>
          )}

          {/* Injection Results */}
          {injectionResult && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-nexus-purple" />
                <span className="text-xs font-semibold">Prompt Injection</span>
                <Badge variant={injectionResult.isInjection ? 'destructive' : 'secondary'} className="text-[10px]">
                  Risco: {injectionResult.riskLevel}
                </Badge>
                <span className={`text-[10px] font-bold ${RISK_COLORS[injectionResult.riskLevel]}`}>
                  {Math.round(injectionResult.confidence * 100)}% confiança
                </span>
              </div>
              {injectionResult.detectedPatterns.length > 0 && (
                <div className="space-y-1">
                  {injectionResult.detectedPatterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      {p.severity === 'high' ? <XCircle className="h-3 w-3 text-destructive" /> : <AlertTriangle className="h-3 w-3 text-nexus-amber" />}
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="outline" className="text-[9px]">{p.severity}</Badge>
                      <span className="text-muted-foreground truncate">{p.matched}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Output Safety */}
          {outputResult && !outputResult.safe && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-xs font-semibold">Output Safety: {outputResult.issues.join(', ')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

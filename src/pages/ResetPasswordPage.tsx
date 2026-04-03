import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Lock, ArrowRight, Eye, EyeOff, Check, X, ShieldCheck } from "lucide-react";
import { useMemo } from "react";

function PasswordStrength({ password }: { password: string }) {
  const checks = useMemo(() => [
    { label: 'Mínimo 8 caracteres', ok: password.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(password) },
    { label: 'Letra minúscula', ok: /[a-z]/.test(password) },
    { label: 'Número', ok: /\d/.test(password) },
  ], [password]);

  const strength = checks.filter(c => c.ok).length;
  const strengthColor = strength <= 1 ? 'bg-destructive' : strength <= 2 ? 'bg-nexus-amber' : strength <= 3 ? 'bg-nexus-cyan' : 'bg-nexus-emerald';

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2" aria-label="Requisitos de senha">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-secondary'}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map(c => (
          <span key={c.label} className={`text-[11px] flex items-center gap-1 ${c.ok ? 'text-nexus-emerald' : 'text-muted-foreground'}`}>
            {c.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Also check hash for recovery token
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const validate = useCallback(() => {
    const errs: { password?: string; confirm?: string } = {};
    if (!password) errs.password = 'Nova senha é obrigatória';
    else if (password.length < 8) errs.password = 'Mínimo 8 caracteres';
    if (!confirmPassword) errs.confirm = 'Confirme a nova senha';
    else if (password !== confirmPassword) errs.confirm = 'As senhas não coincidem';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const { error } = await updatePassword(password);
    if (error) {
      toast.error("Erro ao redefinir senha", { description: error.message });
    } else {
      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-nexus-emerald/15 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-7 w-7 text-nexus-emerald" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Senha redefinida!</h1>
          <p className="text-sm text-muted-foreground">Redirecionando para o painel...</p>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link de recuperação é inválido ou expirou.
          </p>
          <Button onClick={() => navigate("/auth")} variant="outline" className="mx-auto">
            Voltar para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto" aria-hidden="true">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">Escolha uma nova senha para sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="nexus-card space-y-5" noValidate>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password" className="text-sm">Nova senha</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }}
                  placeholder="••••••••"
                  className={`pl-10 pr-10 bg-secondary/50 border-border/50 ${errors.password ? 'border-destructive' : ''}`}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p id="password-error" className="text-[11px] text-destructive mt-1" role="alert">{errors.password}</p>}
              <PasswordStrength password={password} />
            </div>

            <div>
              <Label htmlFor="confirm-password" className="text-sm">Confirmar nova senha</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirm: undefined })); }}
                  placeholder="••••••••"
                  className={`pl-10 bg-secondary/50 border-border/50 ${errors.confirm ? 'border-destructive' : ''}`}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirm}
                  aria-describedby={errors.confirm ? 'confirm-error' : undefined}
                />
              </div>
              {errors.confirm && <p id="confirm-error" className="text-[11px] text-destructive mt-1" role="alert">{errors.confirm}</p>}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2 nexus-gradient-bg text-primary-foreground hover:opacity-90 min-h-[44px]">
            {loading ? "Aguarde..." : "Redefinir senha"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </div>
    </div>
  );
}

import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Bot, Mail, Lock, ArrowRight, Eye, EyeOff, Check, X } from "lucide-react";

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
          <span key={c.label} className={`text-[10px] flex items-center gap-1 ${c.ok ? 'text-nexus-emerald' : 'text-muted-foreground'}`}>
            {c.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // 1 minute

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Countdown timer for lockout
  useState(() => {
    const interval = setInterval(() => {
      if (lockoutUntil) {
        const remaining = Math.max(0, lockoutUntil - Date.now());
        setLockoutRemaining(remaining);
        if (remaining === 0) {
          setLockoutUntil(null);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const validate = useCallback(() => {
    const errs: { email?: string; password?: string } = {};
    if (!email) errs.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'E-mail inválido';
    if (!password) errs.password = 'Senha é obrigatória';
    else if (password.length < 6) errs.password = 'Mínimo 6 caracteres';
    else if (!isLogin && password.length < 8) errs.password = 'Mínimo 8 caracteres para nova conta';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [email, password, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        const msg = error.message.includes('Invalid login')
          ? 'E-mail ou senha incorretos'
          : error.message.includes('Email not confirmed')
          ? 'Confirme seu e-mail antes de entrar'
          : error.message;
        toast.error("Erro ao entrar", { description: msg });
      } else {
        toast.success("Login realizado!");
        navigate("/");
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        const msg = error.message.includes('already registered')
          ? 'Este e-mail já está cadastrado'
          : error.message;
        toast.error("Erro ao criar conta", { description: msg });
      } else {
        toast.success("Conta criada!", {
          description: "Verifique seu e-mail para confirmar o cadastro.",
        });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto" aria-hidden="true">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Fator X</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Entre para gerenciar seus agentes" : "Crie sua conta para começar"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="nexus-card space-y-5" noValidate>
          <div className="space-y-4">
            <div>
              <Label htmlFor="auth-email" className="text-sm">E-mail</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                  placeholder="seu@email.com"
                  className={`pl-10 bg-secondary/50 border-border/50 ${errors.email ? 'border-destructive' : ''}`}
                  required
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
              </div>
              {errors.email && <p id="email-error" className="text-[11px] text-destructive mt-1" role="alert">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="auth-password" className="text-sm">Senha</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }}
                  placeholder="••••••••"
                  className={`pl-10 pr-10 bg-secondary/50 border-border/50 ${errors.password ? 'border-destructive' : ''}`}
                  required
                  minLength={6}
                  autoComplete={isLogin ? "current-password" : "new-password"}
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
              {!isLogin && <PasswordStrength password={password} />}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2 nexus-gradient-bg text-primary-foreground hover:opacity-90 min-h-[44px]">
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setErrors({}); }} className="text-primary hover:underline font-medium">
              {isLogin ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

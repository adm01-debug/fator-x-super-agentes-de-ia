import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
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
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockoutUntil - Date.now());
      setLockoutRemaining(remaining);
      if (remaining === 0) {
        setLockoutUntil(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { email?: string } = {};
    if (!email) errs.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'E-mail inválido';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      toast.error("Erro ao enviar e-mail", { description: error.message });
    } else {
      toast.success("E-mail enviado!", {
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
      setIsForgotPassword(false);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) {
      toast.error("Muitas tentativas", {
        description: `Aguarde ${Math.ceil(lockoutRemaining / 1000)}s antes de tentar novamente.`,
      });
      return;
    }
    if (!validate()) return;
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
          setLockoutRemaining(LOCKOUT_DURATION_MS);
          setFailedAttempts(0);
          toast.error("Conta bloqueada temporariamente", {
            description: "Muitas tentativas falhas. Aguarde 1 minuto.",
          });
        } else {
          const msg = error.message.includes('Invalid login')
            ? `E-mail ou senha incorretos (${MAX_ATTEMPTS - newAttempts} tentativas restantes)`
            : error.message.includes('Email not confirmed')
            ? 'Confirme seu e-mail antes de entrar'
            : error.message;
          toast.error("Erro ao entrar", { description: msg });
        }
      } else {
        setFailedAttempts(0);
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
            {isForgotPassword
              ? "Informe seu e-mail para recuperar a senha"
              : isLogin ? "Entre para gerenciar seus agentes" : "Crie sua conta para começar"
            }
          </p>
        </div>

        <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="nexus-card space-y-5" noValidate>
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

            {!isForgotPassword && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="auth-password" className="text-sm">Senha</Label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setErrors({}); }}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
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
            )}
          </div>

          {isLockedOut && !isForgotPassword && (
            <p className="text-xs text-destructive text-center font-medium" role="alert">
              🔒 Bloqueado — aguarde {Math.ceil(lockoutRemaining / 1000)}s
            </p>
          )}

          <Button type="submit" disabled={loading || (isLockedOut && !isForgotPassword)} className="w-full gap-2 nexus-gradient-bg text-primary-foreground hover:opacity-90 min-h-[44px]">
            {isForgotPassword
              ? (loading ? "Enviando..." : "Enviar link de recuperação")
              : isLockedOut
              ? `Aguarde ${Math.ceil(lockoutRemaining / 1000)}s`
              : loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"
            }
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          {!isForgotPassword && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-card px-2 text-muted-foreground">ou continue com</span></div>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                className="w-full gap-2 min-h-[44px]"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const result = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (result.error) {
                      toast.error("Erro ao entrar com Google", { description: String(result.error) });
                    } else if (result.redirected) {
                      return;
                    } else {
                      toast.success("Login com Google realizado!");
                      navigate("/");
                    }
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Erro inesperado");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </Button>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {isForgotPassword ? (
              <button type="button" onClick={() => { setIsForgotPassword(false); setErrors({}); }} className="text-primary hover:underline font-medium">
                Voltar para o login
              </button>
            ) : (
              <>
                {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
                <button type="button" onClick={() => { setIsLogin(!isLogin); setErrors({}); }} className="text-primary hover:underline font-medium">
                  {isLogin ? "Criar conta" : "Entrar"}
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

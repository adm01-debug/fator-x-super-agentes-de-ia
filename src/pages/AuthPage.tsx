import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Eye, EyeOff, Check, X, Shield, Brain, Zap } from "lucide-react";
import { FatorXLogo } from "@/components/shared/FatorXLogo";

/* ── Password Strength ────────────────────────────────── */
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

/* ── Feature Pill ─────────────────────────────────────── */
function FeaturePill({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span>{text}</span>
    </div>
  );
}

/* ── Animated Grid Background ─────────────────────────── */
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

/* ── Animated Mesh Gradient ───────────────────────────── */
function MeshGradient() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Blob 1 — primary */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
        style={{
          background: 'hsl(var(--primary))',
          top: '10%',
          left: '5%',
          animation: 'meshBlob1 12s ease-in-out infinite',
        }}
      />
      {/* Blob 2 — accent */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
        style={{
          background: 'hsl(var(--accent))',
          top: '50%',
          left: '30%',
          animation: 'meshBlob2 15s ease-in-out infinite',
        }}
      />
      {/* Blob 3 — nexus-cyan */}
      <div
        className="absolute w-[350px] h-[350px] rounded-full opacity-10 blur-[120px]"
        style={{
          background: 'hsl(var(--nexus-purple))',
          top: '20%',
          right: '0%',
          animation: 'meshBlob3 18s ease-in-out infinite',
        }}
      />
      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary/30"
          style={{
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `floatParticle ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${Math.random() * -20}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Google Icon ──────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/* ── Constants ────────────────────────────────────────── */
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000;

/* ── Auth Page ────────────────────────────────────────── */
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

  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockoutUntil - Date.now());
      setLockoutRemaining(remaining);
      if (remaining === 0) setLockoutUntil(null);
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
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      toast.error("Erro ao enviar e-mail", { description: error.message });
    } else {
      toast.success("E-mail enviado!", { description: "Verifique sua caixa de entrada para redefinir a senha." });
      setIsForgotPassword(false);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) {
      toast.error("Muitas tentativas", { description: `Aguarde ${Math.ceil(lockoutRemaining / 1000)}s antes de tentar novamente.` });
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
          toast.error("Conta bloqueada temporariamente", { description: "Muitas tentativas falhas. Aguarde 1 minuto." });
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
        const msg = error.message.includes('already registered') ? 'Este e-mail já está cadastrado' : error.message;
        toast.error("Erro ao criar conta", { description: msg });
      } else {
        toast.success("Conta criada!", { description: "Verifique seu e-mail para confirmar o cadastro." });
      }
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
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
  };

  return (
    <div className="min-h-screen relative flex bg-background overflow-hidden">
      <GridBackground />

      {/* ─── Left branding panel (hidden on mobile) ─── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 xl:p-16">
        <MeshGradient />
        {/* Logo area */}
        <div className="animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <FatorXLogo size={22} className="text-primary-foreground" />
            </div>
            <span className="text-xl font-heading font-bold text-foreground tracking-tight">Fator X</span>
          </div>
        </div>

        {/* Hero copy */}
        <div className="space-y-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="space-y-4 max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-heading font-bold text-foreground leading-[1.1] tracking-tight">
              Construa agentes de IA{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                extraordinários
              </span>
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-md">
              Orquestre, monitore e escale seus agentes inteligentes com a plataforma mais completa do mercado.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            <FeaturePill icon={Brain} text="Multi-modelo (GPT, Gemini, Claude)" />
            <FeaturePill icon={Shield} text="Guardrails & Observabilidade" />
            <FeaturePill icon={Zap} text="Deploy em 1 clique" />
          </div>
        </div>

        {/* Trust footer */}
        <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <p className="text-xs text-muted-foreground/60">
            🔒 Criptografia ponta-a-ponta · SOC 2 · LGPD Compliant
          </p>
        </div>
      </div>

      {/* ─── Right form panel ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 relative z-10">
        <div className="w-full max-w-[420px] space-y-8 animate-fade-in">

          {/* Mobile-only logo */}
          <div className="lg:hidden text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <FatorXLogo size={22} className="text-primary-foreground" />
              </div>
              <span className="text-xl font-heading font-bold text-foreground tracking-tight">Fator X</span>
            </div>
            <p className="text-sm text-muted-foreground">A plataforma que potencializa seus agentes de IA</p>
          </div>

          {/* Header */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">
              {isForgotPassword ? "Recuperar senha" : isLogin ? "Bem-vindo de volta" : "Criar sua conta"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isForgotPassword
                ? "Informe seu e-mail para recuperar o acesso"
                : isLogin ? "Entre para continuar gerenciando seus agentes" : "Comece gratuitamente, sem cartão de crédito"
              }
            </p>
          </div>

          {/* Google button first (social proof pattern) */}
          {!isForgotPassword && (
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                className="w-full gap-3 min-h-[48px] bg-card/50 backdrop-blur-sm border-border/50 hover:bg-card hover:border-border hover:shadow-md transition-all duration-200 group"
                onClick={handleGoogleLogin}
              >
                <GoogleIcon />
                <span className="font-medium">Continuar com Google</span>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/40" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-background px-3 text-muted-foreground/60">ou com e-mail</span>
                </div>
              </div>
            </div>
          )}

          {/* Form card */}
          <form
            onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit}
            className="space-y-5 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-primary/[0.03]"
            noValidate
          >
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-sm font-medium text-foreground">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                  <Input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                    placeholder="voce@empresa.com"
                    className={`pl-10 h-12 bg-secondary/30 border-border/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40 ${errors.email ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                    required
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && <p id="email-error" className="text-[11px] text-destructive mt-0.5 pl-1" role="alert">{errors.email}</p>}
              </div>

              {/* Password */}
              {!isForgotPassword && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password" className="text-sm font-medium text-foreground">Senha</Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => { setIsForgotPassword(true); setErrors({}); }}
                        className="text-[11px] text-primary/80 hover:text-primary font-medium transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                    <Input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }}
                      placeholder="••••••••"
                      className={`pl-10 pr-10 h-12 bg-secondary/30 border-border/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40 ${errors.password ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                      required
                      minLength={6}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p id="password-error" className="text-[11px] text-destructive mt-0.5 pl-1" role="alert">{errors.password}</p>}
                  {!isLogin && <PasswordStrength password={password} />}
                </div>
              )}
            </div>

            {isLockedOut && !isForgotPassword && (
              <p className="text-xs text-destructive text-center font-medium py-1" role="alert">
                🔒 Bloqueado — aguarde {Math.ceil(lockoutRemaining / 1000)}s
              </p>
            )}

            {/* Submit CTA */}
            <Button
              type="submit"
              disabled={loading || (isLockedOut && !isForgotPassword)}
              className="w-full gap-2 min-h-[48px] nexus-gradient-bg text-primary-foreground hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 group font-medium"
            >
              {isForgotPassword
                ? (loading ? "Enviando..." : "Enviar link de recuperação")
                : isLockedOut
                ? `Aguarde ${Math.ceil(lockoutRemaining / 1000)}s`
                : loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"
              }
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-sm text-muted-foreground">
            {isForgotPassword ? (
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setErrors({}); }}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                ← Voltar para o login
              </button>
            ) : (
              <>
                {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
                <button
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setErrors({}); }}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  {isLogin ? "Criar conta" : "Entrar"}
                </button>
              </>
            )}
          </p>

          {/* Trust badge (mobile) */}
          <div className="lg:hidden text-center">
            <p className="text-[11px] text-muted-foreground/50">
              🔒 Criptografia ponta-a-ponta · LGPD Compliant
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

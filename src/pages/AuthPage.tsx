import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { FatorXLogo } from "@/components/shared/FatorXLogo";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { AuthBrandingPanel, GridBackground, GoogleIcon } from "@/components/auth/AuthBrandingPanel";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000;

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
  const { check: checkBreach } = usePasswordBreachCheck();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => { const remaining = Math.max(0, lockoutUntil - Date.now()); setLockoutRemaining(remaining); if (remaining === 0) setLockoutUntil(null); }, 1000);
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
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ email: 'E-mail inválido' }); return; }
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) toast.error("Erro ao enviar e-mail", { description: error.message });
    else { toast.success("E-mail enviado!", { description: "Verifique sua caixa de entrada." }); setIsForgotPassword(false); }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) { toast.error("Muitas tentativas", { description: `Aguarde ${Math.ceil(lockoutRemaining / 1000)}s.` }); return; }
    if (!validate()) return;
    setLoading(true);
    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) { setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS); setLockoutRemaining(LOCKOUT_DURATION_MS); setFailedAttempts(0); toast.error("Conta bloqueada temporariamente"); }
        else { const msg = error.message.includes('Invalid login') ? `E-mail ou senha incorretos (${MAX_ATTEMPTS - newAttempts} tentativas restantes)` : error.message.includes('Email not confirmed') ? 'Confirme seu e-mail antes de entrar' : error.message; toast.error("Erro ao entrar", { description: msg }); }
      } else { setFailedAttempts(0); toast.success("Login realizado!"); navigate("/"); }
    } else {
      // Check if password appeared in known breaches before signing up
      const { breached, count } = await checkBreach(password);
      if (breached) {
        toast.error("Senha comprometida", {
          description: `Esta senha apareceu em ${count.toLocaleString('pt-BR')} vazamentos. Escolha outra mais segura.`,
        });
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password);
      if (error) { const msg = error.message.includes('already registered') ? 'Este e-mail já está cadastrado' : error.message; toast.error("Erro ao criar conta", { description: msg }); }
      else toast.success("Conta criada!", { description: "Verifique seu e-mail para confirmar." });
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) toast.error("Erro ao entrar com Google", { description: String(result.error) });
      else if (result.redirected) return;
      else { toast.success("Login com Google realizado!"); navigate("/"); }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative flex bg-background overflow-hidden">
      <GridBackground />
      <AuthBrandingPanel />
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 relative z-10">
        <div className="w-full max-w-[420px] space-y-8 animate-fade-in">
          <div className="lg:hidden text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20"><FatorXLogo size={22} className="text-primary-foreground" /></div>
              <span className="text-xl font-heading font-bold text-foreground tracking-tight">Fator X</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">{isForgotPassword ? "Recuperar senha" : isLogin ? "Bem-vindo de volta" : "Criar sua conta"}</h1>
            <p className="text-sm text-muted-foreground">{isForgotPassword ? "Informe seu e-mail para recuperar o acesso" : isLogin ? "Entre para continuar gerenciando seus agentes" : "Comece gratuitamente, sem cartão de crédito"}</p>
          </div>
          {!isForgotPassword && (
            <div className="space-y-4">
              <Button type="button" variant="outline" disabled={loading} className="w-full gap-3 min-h-[48px] bg-card border-border hover:shadow-md transition-all group" onClick={handleGoogleLogin}><GoogleIcon /><span className="font-medium">Continuar com Google</span></Button>
              <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div><div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-background px-3 text-muted-foreground/60">ou com e-mail</span></div></div>
            </div>
          )}
          <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-5 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-primary/[0.04]" noValidate>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-sm font-medium text-foreground">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input id="auth-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }} placeholder="voce@empresa.com" className={`pl-10 h-12 bg-secondary/30 ${errors.email ? 'border-destructive' : ''}`} required autoComplete="email" />
                </div>
                {errors.email && <p id="email-error" className="text-[11px] text-destructive">{errors.email}</p>}
              </div>
              {!isForgotPassword && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-password" className="text-sm font-medium text-foreground">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }} placeholder="••••••••" className={`pl-10 pr-10 h-12 bg-secondary/30 ${errors.password ? 'border-destructive' : ''}`} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                  {errors.password && <p className="text-[11px] text-destructive">{errors.password}</p>}
                  {!isLogin && <PasswordStrength password={password} />}
                </div>
              )}
            </div>
            {isLogin && !isForgotPassword && <button type="button" onClick={() => setIsForgotPassword(true)} className="text-[11px] text-primary hover:underline">Esqueci minha senha</button>}
            <Button type="submit" disabled={loading || isLockedOut} className="w-full h-12 nexus-gradient-bg text-primary-foreground font-medium gap-2">
              {loading ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> : <ArrowRight className="h-4 w-4" />}
              {isForgotPassword ? "Enviar link de recuperação" : isLogin ? "Entrar" : "Criar conta"}
            </Button>
            {isLockedOut && <p className="text-[11px] text-destructive text-center">Bloqueado por {Math.ceil(lockoutRemaining / 1000)}s</p>}
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {isForgotPassword ? <button onClick={() => setIsForgotPassword(false)} className="text-primary hover:underline font-medium">Voltar ao login</button>
            : <>{isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}<button onClick={() => { setIsLogin(!isLogin); setErrors({}); setPassword(''); }} className="text-primary hover:underline font-medium">{isLogin ? "Criar conta" : "Entrar"}</button></>}
          </p>
        </div>
      </div>
    </div>
  );
}

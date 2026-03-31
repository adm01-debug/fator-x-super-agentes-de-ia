import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Bot, Mail, Lock, ArrowRight } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error("Erro ao entrar", { description: error.message });
      } else {
        toast.success("Login realizado!");
        navigate("/");
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        toast.error("Erro ao criar conta", { description: error.message });
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
          <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Nexus Agent Platform</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Entre para gerenciar seus agentes" : "Crie sua conta para começar"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="nexus-card space-y-5">
          <div className="space-y-4">
            <div>
              <Label className="text-sm">E-mail</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-10 bg-secondary/50 border-border/50"
                  required
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Senha</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-secondary/50 border-border/50"
                  required
                  minLength={6}
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2 nexus-gradient-bg text-primary-foreground hover:opacity-90">
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
              {isLogin ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

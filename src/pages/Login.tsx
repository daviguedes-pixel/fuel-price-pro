import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntegraLogo } from "@/components/IntegraLogo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [logoSrc, setLogoSrc] = useState<string>(
    "/lovable-uploads/integra-logo-login.png"
  );
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const { error, data } = await signIn(email, password) as any;
      if (error) {
        toast.error("Erro no login: " + (error.message || "Credenciais inválidas"));
      } else {
        // Se usuário entrou com a senha padrão, forçar troca de senha
        if (password === "sr123" || password === "SR@123") {
          toast.message("Senha padrão detectada", { description: "Defina uma nova senha para continuar." });
          navigate("/change-password", { replace: true });
          return;
        }
        toast.success("Login realizado com sucesso!");
      }
    } catch (error) {
      toast.error("Erro inesperado no login");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if user is already logged in
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/lovable-uploads/b72ab13f-d8c6-4300-9059-7bf26de48e79.png')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-800/50 to-slate-900/60 backdrop-blur-[2px]" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8 animate-in fade-in duration-500">
          <div className="mb-2 flex flex-col items-center justify-center relative">
            {/* Decorative background behind logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-2xl" />
            </div>
            <div className="relative flex justify-center">
              <img 
                src={logoSrc}
                alt="Integra Logo"
                className="h-[160px] drop-shadow-2xl"
                onError={(e) => {
                  console.error('Erro ao carregar logo do login:', logoSrc);
                  // Tenta diferentes caminhos como fallback
                  if (logoSrc.includes('integra-logo-login')) {
                    // Primeiro fallback: símbolo
                    setLogoSrc('/lovable-uploads/integra-logo-symbol.png');
                  } else if (logoSrc.includes('integra-logo-symbol')) {
                    // Segundo fallback: logo completo
                    setLogoSrc('/lovable-uploads/integra-logo.png');
                  } else {
                    // Último fallback: qualquer imagem disponível
                    console.warn('Todas as tentativas de carregar a logo falharam');
                  }
                }}
                onLoad={() => {
                  console.log('Logo do login carregada com sucesso:', logoSrc);
                }}
              />
            </div>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg mt-2 font-righteous">
              Integra
            </h1>
          </div>
        </div>

        <Card className="shadow-2xl border-0 bg-white backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl text-center text-gray-800 font-bold">
              Fazer Login
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Entre com suas credenciais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <Mail className="h-4 w-4" />
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@redesaoroque.com.br"
                  className="h-12 text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <Lock className="h-4 w-4" />
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-12 text-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button 
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white font-semibold text-base shadow-lg transition-all duration-300"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar no Sistema"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-white/90 mt-8 drop-shadow-lg font-medium">
          © 2025 Rede São Roque. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
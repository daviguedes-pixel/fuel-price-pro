import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaoRoqueLogo } from "@/components/SaoRoqueLogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function PasswordChange() {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword === "sr123" || newPassword === "SR@123") {
      toast.error("A nova senha deve ser diferente da senha padrão");
      return;
    }

    setLoading(true);
    try {
      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (passwordError) {
        toast.error("Erro ao alterar senha: " + passwordError.message);
        return;
      }

      // Update user profile to remove temporary password flag
      if (user) {
        const { error: profileError } = await supabase
          .from('user_profiles' as any)
          .update({ 
            temporary_password: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      toast.success("Senha alterada com sucesso!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error("Erro inesperado ao alterar senha");
      console.error("Password change error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image - igual ao Login */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/lovable-uploads/b72ab13f-d8c6-4300-9059-7bf26de48e79.png')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-800/50 to-slate-900/60 backdrop-blur-[2px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo / header - igual ao Login */}
        <div className="text-center mb-8 animate-in fade-in duration-500">
          <div className="mb-6 flex justify-center relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-2xl" />
            </div>
            <div className="relative">
              <SaoRoqueLogo className="h-20 drop-shadow-2xl" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg mb-2">
            Portal Comercial
          </h1>
          <p className="text-white/80 text-sm drop-shadow-md">
            Altere sua senha para continuar
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl text-center text-foreground font-bold">
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-semibold">
                  Nova Senha
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  className="h-12 text-base"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold">
                  Confirmar Nova Senha
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="h-12 text-base"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Requisitos da senha:</strong>
                  <br />• Mínimo de 6 caracteres
                  <br />• Diferente da senha padrão (sr123)
                </p>
              </div>

              <Button 
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white font-semibold text-base shadow-lg transition-all duration-300"
                disabled={loading}
              >
                {loading ? "Alterando..." : "Alterar Senha"}
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
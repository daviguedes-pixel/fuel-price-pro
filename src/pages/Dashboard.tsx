import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  BarChart3, 
  Search, 
  Map,
  TrendingUp,
  Activity,
  ArrowRight,
  History,
  FileText,
  Users,
  Settings,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { profile } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();

  const quickActions = [
    {
      icon: DollarSign,
      title: "Nova Solicitação",
      description: "Criar solicitação de preço",
      href: "/solicitacao-preco",
      permission: "price_request",
    },
    {
      icon: BarChart3,
      title: "Aprovações",
      description: "Revisar pendências",
      href: "/approvals",
      permission: "approvals",
    },
    {
      icon: Search,
      title: "Pesquisa",
      description: "Preços de mercado",
      href: "/competitor-research",
      permission: "research",
    },
    {
      icon: Map,
      title: "Mapa",
      description: "Visão geográfica",
      href: "/map",
      permission: "map",
    },
    {
      icon: History,
      title: "Histórico",
      description: "Consultar preços",
      href: "/price-history",
      permission: "price_history",
    },
    {
      icon: FileText,
      title: "Referências",
      description: "Gerenciar produtos",
      href: "/reference-registration",
      permission: "reference_registration",
    },
    {
      icon: Users,
      title: "Gestão",
      description: "Administração",
      href: "/gestao",
      permission: "admin",
    },
    {
      icon: Settings,
      title: "Configurações",
      description: "Sistema",
      href: "/settings",
      permission: "admin",
    },
  ].filter(action => canAccess(action.permission));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-6 lg:p-8">
      <div className="container mx-auto max-w-7xl space-y-6 md:space-y-8">
        {/* Header Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {getGreeting()}, {profile?.nome?.split(' ')[0] || 'Usuário'}!
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Bem-vindo ao Sistema de Gestão de Preços
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        {quickActions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg md:text-xl font-semibold text-foreground">
              Acesso Rápido
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Card 
                  key={action.href}
                  className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer border-border hover:border-primary/50 bg-card/50 backdrop-blur-sm"
                  onClick={() => navigate(action.href)}
                >
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:from-primary/30 group-hover:to-primary/20 transition-all">
                        <action.icon className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                          {action.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {action.description}
                        </p>
                      </div>
                      <div className="flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Acessar</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Welcome Card */}
          <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent hover:shadow-lg transition-shadow">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Sistema de Gestão de Preços
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Gerencie solicitações de preços, acompanhe aprovações e tome decisões estratégicas 
                      com base em dados atualizados do mercado.
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate("/solicitacao-preco")}
                    className="w-full sm:w-auto"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Nova Solicitação
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="border-border bg-gradient-to-br from-green-500/5 to-transparent hover:shadow-lg transition-shadow">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Sistema Online
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Todas as funcionalidades estão disponíveis e operacionais. 
                      Utilize o menu lateral para navegar entre as diferentes áreas do sistema.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Sistema Operacional</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  BarChart3, 
  Map,
  TrendingUp,
  Activity,
  ArrowRight,
  History,
  FileText,
  Users,
  Settings
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
      icon: Map,
      title: "Mapa",
      description: "Referências",
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
    <div className="min-h-full bg-background p-6">
      <div className="container mx-auto max-w-7xl space-y-6">
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {getGreeting()}, {profile?.nome?.split(' ')[0]}! 👋
          </h1>
          <p className="text-base text-muted-foreground">
            Bem-vindo ao Sistema de Gestão de Preços da Rede São Roque
          </p>
        </div>

        {/* Quick Actions Grid */}
        {quickActions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Acesso Rápido
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Card 
                  key={action.href}
                  className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border hover:border-primary/50 hover:scale-[1.02]"
                  onClick={() => navigate(action.href)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:from-primary/30 group-hover:to-primary/20 transition-all">
                        <action.icon className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                          {action.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                      <div className="flex items-center text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Acessar <ArrowRight className="h-4 w-4 ml-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Welcome Card */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-3 flex-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    Sistema Operacional
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Todas as funcionalidades estão disponíveis para uso. 
                    Utilize o menu lateral para navegar entre as diferentes áreas do sistema e gerenciar suas solicitações de preço.
                  </p>
                  <Button 
                    onClick={() => navigate("/solicitacao-preco")}
                    size="sm"
                    className="mt-2"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Nova Solicitação
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="space-y-3 flex-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    Status do Sistema
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Gerencie preços, acompanhe aprovações e tome decisões estratégicas 
                    com base em dados atualizados do mercado em tempo real.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Sistema Online</span>
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

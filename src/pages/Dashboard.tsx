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
  Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardStats from "@/components/DashboardStats";

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
    <div className="min-h-full bg-background p-6">
      <div className="container mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {getGreeting()}, {profile?.nome?.split(' ')[0]}
          </h1>
          <p className="text-lg text-muted-foreground">
            Sistema de Gestão de Preços
          </p>
        </div>

        {/* Stats */}
        <DashboardStats />

        {/* Quick Actions Grid */}
        {quickActions.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Acesso Rápido
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Card 
                  key={action.href}
                  className="group hover:shadow-md transition-all duration-200 cursor-pointer border-border hover:border-primary/50"
                  onClick={() => navigate(action.href)}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                          {action.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {action.description}
                        </p>
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
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-3 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    Sistema Operacional
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Todas as funcionalidades estão disponíveis para uso. 
                    Utilize o menu lateral para navegar entre as diferentes áreas do sistema.
                  </p>
                  <Button 
                    onClick={() => navigate("/solicitacao-preco")}
                    size="sm"
                    className="mt-2"
                  >
                    Nova Solicitação
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-6 w-6 text-success" />
                </div>
                <div className="space-y-3 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    Status do Sistema
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Gerencie preços, acompanhe aprovações e tome decisões estratégicas 
                    com base em dados atualizados do mercado.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                    <span className="text-xs text-success font-medium">Online</span>
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

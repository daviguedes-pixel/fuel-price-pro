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
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
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
      color: "text-primary"
    },
    {
      icon: BarChart3,
      title: "Aprovações",
      description: "Revisar pendências",
      href: "/approvals",
      permission: "approvals",
      color: "text-accent"
    },
    {
      icon: Search,
      title: "Pesquisa",
      description: "Preços de mercado",
      href: "/competitor-research",
      permission: "research",
      color: "text-success"
    },
    {
      icon: Map,
      title: "Mapa",
      description: "Visão geográfica",
      href: "/map",
      permission: "map",
      color: "text-muted-foreground"
    },
  ].filter(action => canAccess(action.permission));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-3">
            {getGreeting()}, {profile?.nome?.split(' ')[0]}
          </h1>
          <p className="text-xl text-muted-foreground">
            Sistema de Gestão de Preços - São Roque
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {quickActions.map((action) => (
            <Card 
              key={action.href}
              className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-border hover:border-primary/50"
              onClick={() => navigate(action.href)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <action.icon className={`h-6 w-6 ${action.color} group-hover:text-primary transition-colors`} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Welcome Card */}
          <Card className="border-border">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-foreground">
                    Bem-vindo ao Sistema
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Gerencie preços, acompanhe aprovações e tome decisões estratégicas 
                    com base em dados atualizados do mercado.
                  </p>
                  <Button 
                    onClick={() => navigate("/solicitacao-preco")}
                    className="mt-4"
                  >
                    Começar agora
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="border-border">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-6 w-6 text-accent" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-foreground">
                    Sistema Operacional
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Todas as funcionalidades estão disponíveis. 
                    Use o menu lateral para navegar entre as diferentes áreas do sistema.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                    <span className="text-sm text-success font-medium">Sistema Online</span>
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

export default Index;

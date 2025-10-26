import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import DashboardStats from "@/components/DashboardStats";
import { 
  DollarSign, 
  BarChart3,
  Search,
  Map,
  FileText,
  TrendingUp,
  Sparkles,
  Settings,
  Users,
  Shield
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { permissions, canAccess } = usePermissions();

  // Definir todas as ações possíveis com suas permissões
  const allActions = [
    {
      title: "Solicitação de Preços",
      description: "Solicite novos preços ou atualizações",
      icon: DollarSign,
      color: "from-blue-500 to-indigo-500",
      href: "/solicitacao-preco",
      permission: "price_request"
    },
    {
      title: "Aprovações",
      description: "Gerencie aprovações de preços",
      icon: BarChart3,
      color: "from-green-500 to-emerald-500",
      href: "/approvals",
      permission: "approvals"
    },
    {
      title: "Pesquisa de Preços Públicos",
      description: "Analise preços da concorrência",
      icon: Search,
      color: "from-purple-500 to-pink-500",
      href: "/competitor-research",
      permission: "research"
    },
    {
      title: "Mapa de Preços",
      description: "Visualize preços geograficamente",
      icon: Map,
      color: "from-orange-500 to-red-500",
      href: "/map",
      permission: "map"
    },
    {
      title: "Referências",
      description: "Gerencie referências de produtos",
      icon: FileText,
      color: "from-cyan-500 to-blue-500",
      href: "/reference-registration",
      permission: "reference_registration"
    },
    {
      title: "Histórico",
      description: "Consulte histórico de preços",
      icon: TrendingUp,
      color: "from-amber-500 to-yellow-500",
      href: "/price-history",
      permission: "price_history"
    },
    {
      title: "Administração",
      description: "Gerencie configurações do sistema",
      icon: Settings,
      color: "from-slate-500 to-gray-500",
      href: "/admin",
      permission: "admin"
    },
    {
      title: "Gestão de Clientes",
      description: "Gerencie dados de clientes",
      icon: Users,
      color: "from-indigo-500 to-purple-500",
      href: "/client-management",
      permission: "client_management"
    },
    {
      title: "Gestão de Taxas",
      description: "Configure métodos de pagamento",
      icon: Shield,
      color: "from-emerald-500 to-teal-500",
      href: "/rate-management",
      permission: "rate_management"
    }
  ];

  // Filtrar ações baseadas nas permissões do usuário
  const availableActions = allActions.filter(action => canAccess(action.permission));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 space-y-12">
        
        {/* Hero Section - Boas Vindas */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-12 text-white shadow-2xl">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-8 w-8 text-yellow-400 animate-pulse" />
              <h1 className="text-5xl font-bold">
                Bem-vindo de volta, {profile?.nome || 'Usuário'}!
              </h1>
            </div>
            <p className="text-blue-100 text-xl max-w-2xl mb-4">
              Acesse rapidamente as funcionalidades disponíveis para seu perfil
            </p>
            {permissions && (
              <div className="flex items-center gap-2 text-blue-200">
                <Shield className="h-5 w-5" />
                <span className="text-sm">
                  Perfil: {permissions.role === 'admin' ? 'Administrador' : 'Usuário'} • 
                  {availableActions.length} funcionalidade{availableActions.length !== 1 ? 's' : ''} disponível{availableActions.length !== 1 ? 'eis' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Estatísticas do Usuário */}
        <DashboardStats />

        {/* Quick Actions Grid - Dinâmico baseado em permissões */}
        {availableActions.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">
              Funcionalidades Disponíveis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableActions.map((action) => (
                <Card 
                  key={action.title}
                  className="group cursor-pointer border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden"
                  onClick={() => navigate(action.href)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-4 rounded-2xl bg-gradient-to-br ${action.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <action.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2 group-hover:text-primary transition-colors">
                          {action.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
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

        {/* Mensagem quando não há funcionalidades disponíveis */}
        {availableActions.length === 0 && (
          <Card className="border-0 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-xl bg-yellow-500/10">
                  <Shield className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Aguardando Permissões
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Seu perfil está sendo configurado. Entre em contato com o administrador para obter acesso às funcionalidades.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <Card className="border-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 shadow-lg">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Portal Comercial - Rede São Roque
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Sistema integrado para gestão de preços, análise de mercado e tomada de decisões estratégicas. 
                  Utilize o menu lateral para navegar entre as funcionalidades disponíveis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

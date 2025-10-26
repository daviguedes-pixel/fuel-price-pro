import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  BarChart3, 
  DollarSign, 
  Users, 
  TrendingUp,
  Shield,
  CheckCircle
} from "lucide-react";

export function DashboardStats() {
  const { permissions, canAccess } = usePermissions();

  if (!permissions) return null;

  // Calcular estatísticas baseadas nas permissões
  const totalFeatures = 9; // Total de funcionalidades possíveis
  const availableFeatures = [
    'price_request', 'approvals', 'research', 'map', 
    'price_history', 'reference_registration', 'admin', 
    'client_management', 'rate_management'
  ].filter(feature => canAccess(feature)).length;

  const stats = [
    {
      title: "Funcionalidades Ativas",
      value: `${availableFeatures}/${totalFeatures}`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20"
    },
    {
      title: "Nível de Acesso",
      value: permissions.role === 'admin' ? 'Administrador' : 'Usuário',
      icon: Shield,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20"
    },
    {
      title: "Margem Máxima",
      value: `${permissions.max_approval_margin}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20"
    },
    {
      title: "Permissões Especiais",
      value: permissions.permissions.can_approve ? 'Sim' : 'Não',
      icon: BarChart3,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => (
        <Card key={index} className="border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  {stat.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default DashboardStats;

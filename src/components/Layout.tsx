import { useState, useCallback, memo, useEffect } from "react";
import { Button } from "./ui/button";
import { 
  BarChart3, 
  DollarSign, 
  Search, 
  Settings, 
  Bell,
  Menu,
  LogOut,
  User,
  Home,
  Map,
  History,
  FileText,
  CreditCard,
  Users,
  Building2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate, useLocation } from "react-router-dom";
import { SaoRoqueLogo } from "./SaoRoqueLogo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";
import RealtimeNotifications from "./RealtimeNotifications";

interface LayoutProps {
  children: React.ReactNode;
}

const getProfileDisplayName = (perfil: string) => {
  const names = {
    'diretor_comercial': 'Diretor Comercial',
    'assessor_comercial': 'Assessor Comercial', 
    'supervisor_comercial': 'Supervisor Comercial',
    'diretor_pricing': 'Diretor de Pricing',
    'analista_pricing': 'Analista de Pricing',
    'gerente': 'Gerente'
  };
  return names[perfil as keyof typeof names] || perfil;
};

const allMenuItems = [
  { icon: Home, label: "Página Inicial", href: "/dashboard", permission: "dashboard" },
  { icon: DollarSign, label: "Solicitação de Preços", href: "/solicitacao-preco", permission: "price_request" },
  { icon: BarChart3, label: "Aprovações", href: "/approvals", permission: "approvals" },
  { icon: Search, label: "Pesquisa de Preços Públicos", href: "/competitor-research", permission: "research" },
  { icon: Map, label: "Mapa de Preços", href: "/map", permission: "map" },
  { icon: History, label: "Histórico", href: "/price-history", permission: "price_history" },
  { icon: FileText, label: "Referências", href: "/reference-registration", permission: "reference_registration" },
  { icon: Building2, label: "Gestão de Postos", href: "/station-management", permission: "admin" },
];

function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { canAccess, permissions } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Filtrar menu items baseado nas permissões
  const menuItems = allMenuItems.filter(item => canAccess(item.permission));

  const handleLogout = useCallback(async () => {
    await signOut();
    navigate("/login", { replace: true });
  }, [signOut, navigate]);

  const handleMenuClick = useCallback((href: string) => {
    navigate(href);
    setSidebarOpen(false);
  }, [navigate]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-600/50 shadow-lg">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="text-white hover:bg-white/20 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <SaoRoqueLogo className="h-10" />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 relative"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              data-notification-bell
            >
              <Bell className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2 text-white">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:block">{profile?.nome}</span>
              <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full hidden md:block">
                {profile ? getProfileDisplayName(profile.perfil) : 'Carregando...'}
              </span>
            </div>

            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <NotificationCenter isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <RealtimeNotifications />

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          bg-card border-r border-border/40 shadow-sm transition-all duration-300 h-[calc(100vh-4rem)]
          ${sidebarOpen ? 'w-64' : 'w-0 lg:w-64'}
          ${sidebarOpen ? 'block' : 'hidden lg:block'}
          overflow-hidden fixed lg:relative z-50 lg:z-auto
        `}>
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className={`w-full justify-start gap-3 h-11 transition-colors ${
                  location.pathname === item.href 
                    ? 'bg-secondary text-primary' 
                    : 'text-muted-foreground hover:text-primary hover:bg-secondary'
                }`}
                onClick={() => handleMenuClick(item.href)}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>

    </div>
  );
}

export default memo(Layout);
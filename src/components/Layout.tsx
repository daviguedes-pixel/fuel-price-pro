import { useState, useCallback, memo } from "react";
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
  Users,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useNotifications } from "@/hooks/useNotifications";
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
  { icon: Home, label: "Início", href: "/dashboard", permission: "dashboard" },
  { icon: DollarSign, label: "Solicitação de Preços", href: "/solicitacao-preco", permission: "price_request" },
  { icon: BarChart3, label: "Aprovações", href: "/approvals", permission: "approvals" },
  { icon: Search, label: "Pesquisa de Preços", href: "/competitor-research", permission: "research" },
  { icon: Map, label: "Mapa", href: "/map", permission: "map" },
  { icon: History, label: "Histórico", href: "/price-history", permission: "price_history" },
  { icon: FileText, label: "Referências", href: "/reference-registration", permission: "reference_registration" },
  { icon: Users, label: "Gestão", href: "/gestao", permission: "admin" },
  { icon: Settings, label: "Configurações", href: "/settings", permission: "admin" },
];

function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { canAccess } = usePermissions();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  
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

  const handleLogoClick = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Navy Blue */}
      <aside className={`
        bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col
        ${sidebarOpen ? 'w-64' : 'w-0 lg:w-64'}
        ${sidebarOpen ? 'fixed' : 'hidden lg:flex'}
        lg:relative z-50 h-screen
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <button 
            onClick={handleLogoClick}
            className="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
          >
            <SaoRoqueLogo className="h-8" />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              className={`w-full justify-start gap-3 h-11 transition-all ${
                location.pathname === item.href 
                  ? 'bg-sidebar-accent text-sidebar-foreground font-medium' 
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
              onClick={() => handleMenuClick(item.href)}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
            </Button>
          ))}
        </nav>

        {/* User Info at bottom */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <User className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.nome}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {profile ? getProfileDisplayName(profile.perfil) : 'Carregando...'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground hidden sm:block">
              Sistema de Gestão de Preços
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <NotificationCenter isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        <RealtimeNotifications />

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default memo(Layout);

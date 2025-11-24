import { useState, useCallback, memo } from "react";
import { Button } from "./ui/button";
import { 
  BarChart3, 
  DollarSign, 
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
  X,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Package,
  Receipt,
  Truck,
  FileCheck,
  Percent
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate, useLocation } from "react-router-dom";
import { IntegraLogo } from "./IntegraLogo";
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

interface MenuItem {
  icon: any;
  label: string;
  href: string;
  permission: string;
}

interface SubGroup {
  label: string;
  items: MenuItem[];
}

interface MenuGroup {
  label: string;
  subgroups?: SubGroup[];
  items?: MenuItem[];
}

const menuStructure: MenuGroup[] = [
  {
    label: "Comercial",
    subgroups: [
      {
        label: "Precificação",
        items: [
          { icon: DollarSign, label: "Solicitações", href: "/solicitacao-preco", permission: "price_request" },
          { icon: BarChart3, label: "Aprovações", href: "/approvals", permission: "approvals" },
        ]
      },
      {
        label: "Estrategia",
        items: [
          { icon: FileText, label: "Referencias", href: "/reference-registration", permission: "reference_registration" },
          { icon: Map, label: "Mapa", href: "/map", permission: "map" },
          { icon: History, label: "Historico", href: "/price-history", permission: "price_history" },
          { icon: BarChart3, label: "Gestor de carteiras", href: "/portfolio-manager", permission: "price_history" },
        ]
      },
      {
        label: "Gestoria",
        items: [
          { icon: Users, label: "Gestão", href: "/gestao", permission: "gestao" },
        ]
      }
    ]
  },
  {
    label: "Pricing",
    items: [
      { icon: Percent, label: "Descontos Indevidos (Desenvolvimento)", href: "/descontos-indevidos", permission: "pricing" },
      { icon: Map, label: "Mapa Contatos (Desenvolvimento)", href: "/mapa-contatos", permission: "pricing" },
      { icon: Truck, label: "Cargas (Desenvolvimento)", href: "/cargas", permission: "pricing" },
      { icon: FileCheck, label: "NFs Incorretas (Desenvolvimento)", href: "/nfs-incorretas", permission: "pricing" },
      { icon: TrendingUp, label: "Paridade (Desenvolvimento)", href: "/paridade", permission: "pricing" },
    ]
  }
];

const homeItem: MenuItem = { icon: Home, label: "Início", href: "/dashboard", permission: "dashboard" };

function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { canAccess } = usePermissions();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Comercial": true,
    "Pricing": true
  });
  const [openSubGroups, setOpenSubGroups] = useState<Record<string, boolean>>({
    "Precificação": true,
    "Estrategia": true,
    "Gestoria": true
  });

  const toggleGroup = useCallback((groupLabel: string) => {
    setOpenGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  }, []);

  const toggleSubGroup = useCallback((subGroupLabel: string) => {
    setOpenSubGroups(prev => ({ ...prev, [subGroupLabel]: !prev[subGroupLabel] }));
  }, []);

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
        lg:sticky lg:top-0 z-50 h-screen max-h-screen overflow-hidden flex-shrink-0
      `}>
        {/* Logo Area */}
        <div className="h-12 flex items-center justify-between px-3 border-b border-sidebar-border">
          <button 
            onClick={handleLogoClick}
            className="flex items-center hover:opacity-80 transition-opacity cursor-pointer -ml-4"
          >
            <IntegraLogo className="h-6" />
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
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {/* Início */}
          {canAccess(homeItem.permission) && (
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 h-9 transition-all mb-2 ${
                location.pathname === homeItem.href 
                  ? 'bg-sidebar-accent text-sidebar-foreground font-medium' 
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
              onClick={() => handleMenuClick(homeItem.href)}
            >
              <homeItem.icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs">{homeItem.label}</span>
            </Button>
          )}

          {/* Grupos */}
          {menuStructure.map((group) => {
            const hasAccessibleItems = group.subgroups 
              ? group.subgroups.some(sub => sub.items.some(item => canAccess(item.permission)))
              : group.items?.some(item => canAccess(item.permission));
            
            if (!hasAccessibleItems) return null;

            return (
              <Collapsible
                key={group.label}
                open={openGroups[group.label] ?? false}
                onOpenChange={() => toggleGroup(group.label)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between gap-2 h-8 px-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 text-xs font-semibold"
                  >
                    <span>{group.label}</span>
                    {openGroups[group.label] ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 pl-2">
                  {group.subgroups?.map((subgroup) => {
                    const accessibleItems = subgroup.items.filter(item => canAccess(item.permission));
                    if (accessibleItems.length === 0) return null;

                    return (
                      <div key={subgroup.label} className="space-y-0.5">
                        <Collapsible
                          open={openSubGroups[subgroup.label] ?? false}
                          onOpenChange={() => toggleSubGroup(subgroup.label)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-between gap-2 h-7 px-2 text-sidebar-foreground/60 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30 text-[11px] font-medium"
                            >
                              <span>{subgroup.label}</span>
                              {openSubGroups[subgroup.label] ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-0.5 pl-3">
                            {accessibleItems.map((item) => (
                              <Button
                                key={item.href}
                                variant="ghost"
                                className={`w-full justify-start gap-2 h-8 px-2 transition-all ${
                                  location.pathname === item.href 
                                    ? 'bg-sidebar-accent text-sidebar-foreground font-medium' 
                                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                                }`}
                                onClick={() => handleMenuClick(item.href)}
                              >
                                <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="text-[11px]">{item.label}</span>
                              </Button>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}
                  {group.items?.filter(item => canAccess(item.permission)).map((item) => (
                    <Button
                      key={item.href}
                      variant="ghost"
                      className={`w-full justify-start gap-2 h-8 px-2 transition-all ${
                        location.pathname === item.href 
                          ? 'bg-sidebar-accent text-sidebar-foreground font-medium' 
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                      }`}
                      onClick={() => handleMenuClick(item.href)}
                    >
                      <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-[11px]">{item.label}</span>
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* User Info at bottom */}
        <div className="p-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-sidebar-accent/30">
            <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.nome}</p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">
                {profile ? getProfileDisplayName(profile.perfil) : 'Carregando...'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Header - Manter branco */}
        <header className="h-12 bg-white dark:bg-card border-b border-border flex items-center justify-between px-3 lg:px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="lg:hidden h-8 w-8 p-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            
            <Button
              variant="ghost"
              size="sm"
              className="relative h-8 w-8 p-0"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none border-2 border-background">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <NotificationCenter isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        <RealtimeNotifications />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
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

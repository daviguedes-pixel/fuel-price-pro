import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { MapConfigProvider } from "@/context/MapConfigContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PriceRequest from "./pages/PriceRequest";
import Approvals from "./pages/Approvals";
import Admin from "./pages/Admin";
import MapView from "./pages/MapView";
import PriceHistory from "./pages/PriceHistory";
import ReferenceRegistration from "./pages/ReferenceRegistration";
import RateManagement from "./pages/RateManagement";
import TaxManagement from "./pages/TaxManagement";
import StationManagement from "./pages/StationManagement";
import ClientManagement from "./pages/ClientManagement";
import PasswordChange from "./pages/PasswordChange";
import AuditLogs from "./pages/AuditLogs";
import PublicPriceResearch from "./pages/CompetitorResearch";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30 minutes (aumentado de 5 minutos)
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false, // Desabilitar refetch ao montar
      retry: false, // Desabilitar retry automático
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  // console.log('ProtectedRoute render', { loading, hasUser: !!user, path: window.location.pathname });
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user needs to change password
  const searchParams = new URLSearchParams(window.location.search);
  const needsPasswordChange = searchParams.get('change-password') === 'true';
  
  if (needsPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  
  return (
    <PermissionsProvider>
      {/* RealtimeNotifications temporariamente desabilitado para reduzir requisições */}
      {/* <NotificationsProvider> */}
        <Layout>{children}</Layout>
      {/* </NotificationsProvider> */}
    </PermissionsProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <MapConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/pricing-suggestion" element={<Navigate to="/solicitacao-preco" replace />} />
                <Route path="/solicitacao-preco" element={<ProtectedRoute><PriceRequest /></ProtectedRoute>} />
                <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
                <Route path="/competitor-research" element={<ProtectedRoute><PublicPriceResearch /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
              <Route path="/price-history" element={<ProtectedRoute><PriceHistory /></ProtectedRoute>} />
              <Route path="/reference-registration" element={<ProtectedRoute><ReferenceRegistration /></ProtectedRoute>} />
              <Route path="/tax-management" element={<ProtectedRoute><TaxManagement /></ProtectedRoute>} />
                <Route path="/station-management" element={<ProtectedRoute><StationManagement /></ProtectedRoute>} />
                <Route path="/client-management" element={<ProtectedRoute><ClientManagement /></ProtectedRoute>} />
                <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                <Route path="/change-password" element={<PasswordChange />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MapConfigProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
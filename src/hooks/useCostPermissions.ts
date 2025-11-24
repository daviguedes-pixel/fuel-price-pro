import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Hook para verificar permissões relacionadas a custos
 * Usuários com perfil "comercial de posto" só podem ver custo de compra + frete atual,
 * sem considerar o custo real
 */
export const useCostPermissions = () => {
  const { user } = useAuth();
  const { hasPermission, userProfiles } = usePermissions();

  // Verificar se o usuário pode ver o custo real
  const canViewRealCost = () => {
    // Se não tiver permissão específica, verificar por perfil
    if (hasPermission('view_real_cost')) {
      return true;
    }

    // Verificar se o usuário tem perfil que permite ver custo real
    // Perfis que NÃO podem ver: "comercial de posto" ou similar
    const restrictedProfiles = ['comercial de posto', 'comercial_posto', 'comercial-posto'];
    
    if (userProfiles && userProfiles.length > 0) {
      const hasRestrictedProfile = userProfiles.some(profile => 
        restrictedProfiles.some(restricted => 
          profile.perfil?.toLowerCase().includes(restricted.toLowerCase())
        )
      );
      
      if (hasRestrictedProfile) {
        return false;
      }
    }

    // Por padrão, permitir ver (se não tiver perfil restritivo)
    return true;
  };

  // Verificar se o usuário pode ver apenas custo de compra + frete
  const canViewBasicCost = () => {
    return true; // Todos podem ver custo básico
  };

  return {
    canViewRealCost: canViewRealCost(),
    canViewBasicCost: canViewBasicCost(),
    isRestricted: !canViewRealCost()
  };
};


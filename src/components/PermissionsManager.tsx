import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";

interface ProfilePermission {
  perfil: string;
  dashboard: boolean;
  price_request: boolean;
  approvals: boolean;
  research: boolean;
  map: boolean;
  price_history: boolean;
  reference_registration: boolean;
  admin: boolean;
  can_approve: boolean;
  can_register: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_view_history: boolean;
  can_manage_notifications: boolean;
}

const perfis = [
  { nome: 'Diretor Comercial', key: 'diretor_comercial' },
  { nome: 'Supervisor Comercial', key: 'supervisor_comercial' },
  { nome: 'Assessor Comercial', key: 'assessor_comercial' },
  { nome: 'Diretor de Pricing', key: 'diretor_pricing' },
  { nome: 'Analista de Pricing', key: 'analista_pricing' },
  { nome: 'Gerente', key: 'gerente' }
];

const abas = [
  { label: 'Página Inicial', key: 'dashboard' },
  { label: 'Solicitação de Preços', key: 'price_request' },
  { label: 'Aprovações', key: 'approvals' },
  { label: 'Pesquisa de Preços Públicos', key: 'research' },
  { label: 'Mapa de Preços', key: 'map' },
  { label: 'Histórico', key: 'price_history' },
  { label: 'Referências', key: 'reference_registration' },
  { label: 'Administração', key: 'admin' }
];

const acoes = [
  { label: 'Pode Aprovar', key: 'can_approve' },
  { label: 'Pode Cadastrar', key: 'can_register' },
  { label: 'Pode Editar', key: 'can_edit' },
  { label: 'Pode Excluir', key: 'can_delete' },
  { label: 'Ver Histórico', key: 'can_view_history' },
  { label: 'Gerenciar Notificações', key: 'can_manage_notifications' }
];

export function PermissionsManager() {
  const [permissions, setPermissions] = useState<Record<string, ProfilePermission>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_permissions')
        .select('*');

      if (error) throw error;

      const permissionsMap: Record<string, ProfilePermission> = {};
      (data || []).forEach((perm: any) => {
        permissionsMap[perm.perfil] = perm;
      });

      setPermissions(permissionsMap);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (perfil: string, key: keyof ProfilePermission) => {
    setPermissions(prev => ({
      ...prev,
      [perfil]: {
        ...prev[perfil],
        [key]: !prev[perfil]?.[key]
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(permissions).map(([perfil, perms]) => ({
        perfil,
        ...perms
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('profile_permissions')
          .upsert(update, { onConflict: 'perfil' });

        if (error) throw error;
      }

      toast.success('Permissões salvas com sucesso!');
      
      // Recarregar para garantir sincronização
      await loadPermissions();
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast.error('Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando permissões...</div>;
  }

  return (
    <div className="space-y-6">
      {perfis.map((perfil) => (
        <div key={perfil.key} className="border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-primary">{perfil.nome}</h3>
          
          {/* Abas do Sistema */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Abas Visíveis</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {abas.map((aba) => (
                <div key={aba.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">{aba.label}</span>
                  <Switch
                    checked={permissions[perfil.key]?.[aba.key as keyof ProfilePermission] as boolean || false}
                    onCheckedChange={() => handleToggle(perfil.key, aba.key as keyof ProfilePermission)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Ações Permitidas */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Ações Permitidas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {acoes.map((acao) => (
                <div key={acao.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">{acao.label}</span>
                  <Switch
                    checked={permissions[perfil.key]?.[acao.key as keyof ProfilePermission] as boolean || false}
                    onCheckedChange={() => handleToggle(perfil.key, acao.key as keyof ProfilePermission)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary-hover text-primary-foreground"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Permissões'}
        </Button>
      </div>
    </div>
  );
}

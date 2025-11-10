import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowUp, ArrowDown, Save, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ApprovalProfileOrder {
  id: string;
  perfil: string;
  order_position: number;
  is_active: boolean;
}

export default function ApprovalOrderConfig() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ApprovalProfileOrder[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<ApprovalProfileOrder | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('approval_profile_order')
        .select('*')
        .order('order_position', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('not found')) {
          toast({
            title: "Tabela não encontrada",
            description: 'A tabela approval_profile_order não foi criada. Execute a migração 20250131000006_create_approval_profile_order.sql no Supabase.',
            variant: "destructive"
          });
          setProfiles([]);
          return;
        }
        throw error;
      }

      setProfiles(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar ordem de aprovação:', error);
      toast({
        title: "Erro",
        description: error?.message || 'Erro ao carregar ordem de aprovação',
        variant: "destructive"
      });
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_permissions')
        .select('perfil')
        .eq('can_approve', true)
        .order('perfil');

      if (error) {
        console.error('Erro ao carregar perfis disponíveis:', error);
        return;
      }

      const perfis = (data || []).map(p => p.perfil).filter(Boolean);
      setAvailableProfiles(perfis);
    } catch (error) {
      console.error('Erro ao carregar perfis disponíveis:', error);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadAvailableProfiles();
  }, []);

  const handleSave = async (profile: Partial<ApprovalProfileOrder>) => {
    try {
      if (!profile.perfil) {
        toast({
          title: "Erro",
          description: 'Selecione um perfil',
          variant: "destructive"
        });
        return;
      }

      if (profile.order_position === undefined || profile.order_position === null) {
        toast({
          title: "Erro",
          description: 'Informe a posição na ordem',
          variant: "destructive"
        });
        return;
      }

      const profileData: any = {
        perfil: profile.perfil,
        order_position: profile.order_position,
        is_active: profile.is_active ?? true
      };

      if (profile.id) {
        // Atualizar
        const { error } = await supabase
          .from('approval_profile_order')
          .update(profileData)
          .eq('id', profile.id);

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('not found')) {
            toast({
              title: "Tabela não encontrada",
              description: 'A tabela approval_profile_order não foi criada. Execute a migração 20250131000006_create_approval_profile_order.sql no Supabase.',
              variant: "destructive"
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Sucesso",
          description: 'Ordem atualizada com sucesso',
        });
      } else {
        // Criar
        const { error } = await supabase
          .from('approval_profile_order')
          .insert(profileData);

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('not found')) {
            toast({
              title: "Tabela não encontrada",
              description: 'A tabela approval_profile_order não foi criada. Execute a migração 20250131000006_create_approval_profile_order.sql no Supabase.',
              variant: "destructive"
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Sucesso",
          description: 'Ordem criada com sucesso',
        });
      }

      setEditingProfile(null);
      setIsCreating(false);
      loadProfiles();
    } catch (error: any) {
      console.error('Erro ao salvar ordem:', error);
      toast({
        title: "Erro",
        description: error?.message || 'Erro ao salvar ordem',
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('approval_profile_order')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('not found')) {
          toast({
            title: "Tabela não encontrada",
            description: 'A tabela approval_profile_order não foi criada. Execute a migração 20250131000006_create_approval_profile_order.sql no Supabase.',
            variant: "destructive"
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: 'Ordem removida com sucesso',
      });
      loadProfiles();
    } catch (error: any) {
      console.error('Erro ao deletar ordem:', error);
      toast({
        title: "Erro",
        description: error?.message || 'Erro ao deletar ordem',
        variant: "destructive"
      });
    }
  };

  const moveUp = async (profile: ApprovalProfileOrder) => {
    if (profile.order_position <= 1) return;

    const previousProfile = profiles.find(p => p.order_position === profile.order_position - 1);
    if (!previousProfile) return;

    try {
      // Trocar posições
      await supabase
        .from('approval_profile_order')
        .update({ order_position: profile.order_position - 1 })
        .eq('id', profile.id);

      await supabase
        .from('approval_profile_order')
        .update({ order_position: profile.order_position })
        .eq('id', previousProfile.id);

      loadProfiles();
    } catch (error: any) {
      console.error('Erro ao mover para cima:', error);
      toast({
        title: "Erro",
        description: 'Erro ao mover perfil',
        variant: "destructive"
      });
    }
  };

  const moveDown = async (profile: ApprovalProfileOrder) => {
    const maxPosition = Math.max(...profiles.map(p => p.order_position));
    if (profile.order_position >= maxPosition) return;

    const nextProfile = profiles.find(p => p.order_position === profile.order_position + 1);
    if (!nextProfile) return;

    try {
      // Trocar posições
      await supabase
        .from('approval_profile_order')
        .update({ order_position: profile.order_position + 1 })
        .eq('id', profile.id);

      await supabase
        .from('approval_profile_order')
        .update({ order_position: profile.order_position })
        .eq('id', nextProfile.id);

      loadProfiles();
    } catch (error: any) {
      console.error('Erro ao mover para baixo:', error);
      toast({
        title: "Erro",
        description: 'Erro ao mover perfil',
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (profile: ApprovalProfileOrder) => {
    try {
      const { error } = await supabase
        .from('approval_profile_order')
        .update({ is_active: !profile.is_active })
        .eq('id', profile.id);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('not found')) {
          toast({
            title: "Tabela não encontrada",
            description: 'A tabela approval_profile_order não foi criada. Execute a migração 20250131000006_create_approval_profile_order.sql no Supabase.',
            variant: "destructive"
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: `Perfil ${!profile.is_active ? 'ativado' : 'desativado'} com sucesso`,
      });
      loadProfiles();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: error?.message || 'Erro ao alterar status',
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 text-white shadow-lg">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">Ordem de Aprovação por Perfil</h1>
              <p className="text-slate-200 text-sm">Configure a ordem hierárquica de aprovação</p>
            </div>
            <Button
              onClick={() => {
                setIsCreating(true);
                setEditingProfile({
                  id: '',
                  perfil: '',
                  order_position: profiles.length + 1,
                  is_active: true
                });
              }}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Perfil
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Como funciona</CardTitle>
            <CardDescription>
              A ordem de aprovação determina qual perfil aprova primeiro. Perfis com menor número de posição aprovam primeiro.
              Apenas perfis com permissão de aprovação (can_approve = true) podem ser adicionados.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Profiles List */}
        <Card>
          <CardHeader>
            <CardTitle>Ordem de Aprovação</CardTitle>
            <CardDescription>Arraste ou use as setas para reorganizar a ordem</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma ordem configurada. Adicione perfis para começar.
                </div>
              ) : (
                profiles.map((profile, index) => (
                  <div
                    key={profile.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      !profile.is_active ? 'opacity-50 bg-muted' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveUp(profile)}
                        disabled={index === 0}
                        className="h-8 w-8 p-0"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveDown(profile)}
                        disabled={index === profiles.length - 1}
                        className="h-8 w-8 p-0"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex-1">
                      <div className="font-semibold">{profile.perfil}</div>
                      <div className="text-sm text-muted-foreground">
                        Posição: {profile.order_position}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={profile.is_active}
                        onCheckedChange={() => toggleActive(profile)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {profile.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingProfile(profile);
                        setIsCreating(false);
                      }}
                    >
                      Editar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(profile.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit/Create Modal */}
        {(editingProfile || isCreating) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{isCreating ? 'Adicionar Perfil' : 'Editar Perfil'}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingProfile(null);
                    setIsCreating(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select
                  value={editingProfile?.perfil || ''}
                  onValueChange={(value) => {
                    if (editingProfile) {
                      setEditingProfile({ ...editingProfile, perfil: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProfiles.map((perfil) => (
                      <SelectItem key={perfil} value={perfil}>
                        {perfil}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Posição na Ordem</Label>
                <Input
                  type="number"
                  min="1"
                  value={editingProfile?.order_position || 1}
                  onChange={(e) => {
                    if (editingProfile) {
                      setEditingProfile({
                        ...editingProfile,
                        order_position: parseInt(e.target.value) || 1
                      });
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Menor número = aprova primeiro
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingProfile?.is_active ?? true}
                  onCheckedChange={(checked) => {
                    if (editingProfile) {
                      setEditingProfile({ ...editingProfile, is_active: checked });
                    }
                  }}
                />
                <Label>Ativo</Label>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (editingProfile) {
                      handleSave(editingProfile);
                    }
                  }}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingProfile(null);
                    setIsCreating(false);
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


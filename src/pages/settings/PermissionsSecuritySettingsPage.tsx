/**
 * Seção de Permissões e Segurança.
 * Nesta fase:
 * - continua salvando preferências reais sobre confirmações reforçadas
 * - passa a permitir criar e editar cargos reais
 * - usa a RPC já existente no banco: upsert_access_role_definition
 * - não apaga cargos nesta etapa
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Save,
  Shield,
  TriangleAlert,
} from 'lucide-react';
import {
  EMPTY_PERMISSION_SECURITY_SETTINGS,
  PermissionSecuritySettingsFormData,
  getPermissionSecuritySettings,
  savePermissionSecuritySettings,
} from '@/src/lib/appSettings';
import {
  listAllAccessRoles,
  upsertAccessRoleDefinition,
} from '@/src/lib/accessManagement';
import { useAuth } from '@/src/contexts/AuthContext';
import { AccessRole } from '@/src/types/database';
import { formatDateTime } from '@/src/lib/utils';
import {
  getPermissionCatalog,
  PermissionDomain,
  PermissionKey,
} from '@/src/domain/access/catalog/permissionCatalog';

const permissionCatalog = getPermissionCatalog();

const DOMAIN_LABELS: Record<PermissionDomain, string> = {
  dashboard: 'Dashboard',
  activities: 'Atividades',
  patients: 'Pacientes',
  procedures: 'Procedimentos',
  treatments: 'Tratamentos',
  financial: 'Financeiro',
  collections: 'Cobranças',
  reports: 'Relatórios',
  users: 'Usuários e Cargos',
  settings: 'Configurações',
};

type RolePermissionMap = Record<PermissionKey, boolean>;

interface RoleEditorFormState {
  roleId: string | null;
  name: string;
  description: string;
  isActive: boolean;
  permissions: RolePermissionMap;
  financialScopeJson: Record<string, boolean>;
}

function buildEmptyPermissionMap(): RolePermissionMap {
  return permissionCatalog.reduce((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {} as RolePermissionMap);
}

function normalizePermissionMap(raw: Record<string, any> | null | undefined): RolePermissionMap {
  const base = buildEmptyPermissionMap();

  permissionCatalog.forEach((item) => {
    base[item.key] = Boolean(raw?.[item.key]);
  });

  return base;
}

function createEmptyRoleEditorState(): RoleEditorFormState {
  return {
    roleId: null,
    name: '',
    description: '',
    isActive: true,
    permissions: buildEmptyPermissionMap(),
    financialScopeJson: {},
  };
}

function buildRoleEditorStateFromRole(role: AccessRole): RoleEditorFormState {
  return {
    roleId: role.id,
    name: role.name || '',
    description: role.description || '',
    isActive: role.is_active,
    permissions: normalizePermissionMap(role.permissions_json),
    financialScopeJson: role.financial_scope_json || {},
  };
}

export default function PermissionsSecuritySettingsPage() {
  const { hasPermission, refreshProfile } = useAuth();
  const canManageRoles = hasPermission('roles_manage');

  const [form, setForm] = useState<PermissionSecuritySettingsFormData>(
    EMPTY_PERMISSION_SECURITY_SETTINGS
  );
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesSaving, setRolesSaving] = useState(false);

  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [roleForm, setRoleForm] = useState<RoleEditorFormState>(
    createEmptyRoleEditorState()
  );

  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [rolesError, setRolesError] = useState('');
  const [rolesSuccess, setRolesSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (canManageRoles) {
      fetchRoles();
    }
  }, [canManageRoles]);

  async function fetchSettings() {
    setLoading(true);
    setLoadError('');
    setSaveError('');
    setSaveSuccess('');

    try {
      const data = await getPermissionSecuritySettings();

      setForm({
        require_delete_patient_confirmation: data.require_delete_patient_confirmation,
        require_delete_treatment_confirmation: data.require_delete_treatment_confirmation,
        require_edit_received_payment_confirmation: data.require_edit_received_payment_confirmation,
        require_delete_financial_record_confirmation:
          data.require_delete_financial_record_confirmation,
        show_sensitive_action_warning: data.show_sensitive_action_warning,
        sensitive_action_guidance_text: data.sensitive_action_guidance_text,
      });

      setSettingsId(data.id);
      setUpdatedAt(data.updated_at);
    } catch (error: any) {
      console.error('Erro ao carregar Permissões e Segurança:', error);
      setLoadError(
        'Não foi possível carregar as configurações de Permissões e Segurança. Verifique se o SQL da fase 1.4 foi executado na tabela app_settings.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles(preferredRoleId?: string | null) {
    setRolesLoading(true);
    setRolesError('');
    setRolesSuccess('');

    try {
      const rolesData = await listAllAccessRoles();
      setRoles(rolesData);

      const nextRole =
        rolesData.find((role) => role.id === preferredRoleId) ||
        rolesData.find((role) => role.id === roleForm.roleId) ||
        rolesData[0] ||
        null;

      if (nextRole) {
        setRoleForm(buildRoleEditorStateFromRole(nextRole));
      } else {
        setRoleForm(createEmptyRoleEditorState());
      }
    } catch (error: any) {
      console.error('Erro ao carregar cargos:', error);
      setRolesError(
        'Não foi possível carregar os cargos. Confirme se a migration 2026-04-017 foi aplicada corretamente no Supabase.'
      );
    } finally {
      setRolesLoading(false);
    }
  }

  function updateField<K extends keyof PermissionSecuritySettingsFormData>(
    field: K,
    value: PermissionSecuritySettingsFormData[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateRoleField<K extends keyof RoleEditorFormState>(
    field: K,
    value: RoleEditorFormState[K]
  ) {
    setRoleForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function selectRole(role: AccessRole) {
    setRolesError('');
    setRolesSuccess('');
    setRoleForm(buildRoleEditorStateFromRole(role));
  }

  function startNewRole() {
    setRolesError('');
    setRolesSuccess('');
    setRoleForm(createEmptyRoleEditorState());
  }

  function togglePermission(permissionKey: PermissionKey, checked: boolean) {
    setRoleForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionKey]: checked,
      },
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const result = await savePermissionSecuritySettings(form, settingsId);
      setSettingsId(result.id);
      setUpdatedAt(result.updated_at);
      setSaveSuccess('Configurações de Permissões e Segurança salvas com sucesso.');
    } catch (error: any) {
      console.error('Erro ao salvar Permissões e Segurança:', error);
      setSaveError(
        'Não foi possível salvar as preferências. Confirme se o SQL da fase 1.4 foi executado e se o usuário autenticado tem acesso à tabela app_settings.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRole() {
    setRolesSaving(true);
    setRolesError('');
    setRolesSuccess('');

    try {
      if (!roleForm.name.trim()) {
        setRolesError('Informe o nome do cargo antes de salvar.');
        return;
      }

      const result = await upsertAccessRoleDefinition({
        roleId: roleForm.roleId,
        name: roleForm.name.trim(),
        description: roleForm.description.trim() || null,
        isActive: roleForm.isActive,
        permissionsJson: roleForm.permissions,
        financialScopeJson: roleForm.financialScopeJson,
      });

      setRolesSuccess(
        roleForm.roleId
          ? 'Cargo atualizado com sucesso.'
          : 'Cargo criado com sucesso.'
      );

      await fetchRoles(result.role_id);
      await refreshProfile();
    } catch (error: any) {
      console.error('Erro ao salvar cargo:', error);
      setRolesError(error.message || 'Não foi possível salvar o cargo.');
    } finally {
      setRolesSaving(false);
    }
  }

  const updatedAtLabel = useMemo(() => {
    if (!updatedAt) return 'Ainda não há salvamento registrado.';
    return `Última atualização: ${formatDateTime(updatedAt)}`;
  }, [updatedAt]);

  const selectedRole = useMemo(() => {
    if (!roleForm.roleId) return null;
    return roles.find((role) => role.id === roleForm.roleId) || null;
  }, [roles, roleForm.roleId]);

  const isCreatingNewRole = roleForm.roleId === null;
  const isSystemRole = Boolean(selectedRole?.is_system_role);

  const permissionsByDomain = useMemo(() => {
    const grouped = new Map<PermissionDomain, typeof permissionCatalog>();

    permissionCatalog.forEach((item) => {
      const current = grouped.get(item.domain) || [];
      current.push(item);
      grouped.set(item.domain, current);
    });

    return Array.from(grouped.entries()).map(([domain, items]) => ({
      domain,
      title: DOMAIN_LABELS[domain],
      items: items.sort((a, b) => a.order - b.order),
    }));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium">Carregando permissões e segurança...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Permissões e Segurança</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure preferências de confirmação e administre cargos e permissões da aplicação.
          </p>
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
          {updatedAtLabel}
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Shield size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Confirmações reforçadas</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Estas preferências serão usadas na próxima etapa para reforçar segurança e reduzir ações críticas feitas por engano.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.require_delete_patient_confirmation}
                onChange={(e) =>
                  updateField('require_delete_patient_confirmation', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exigir confirmação reforçada ao excluir paciente</p>
                <p className="text-xs text-gray-500 mt-1">
                  Prepara a exibição futura de confirmação mais cuidadosa em exclusões de paciente.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.require_delete_treatment_confirmation}
                onChange={(e) =>
                  updateField('require_delete_treatment_confirmation', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exigir confirmação reforçada ao excluir tratamento</p>
                <p className="text-xs text-gray-500 mt-1">
                  Recomendado para reduzir exclusões acidentais em itens com impacto clínico e financeiro.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.require_edit_received_payment_confirmation}
                onChange={(e) =>
                  updateField('require_edit_received_payment_confirmation', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exigir confirmação reforçada ao alterar pagamento já lançado</p>
                <p className="text-xs text-gray-500 mt-1">
                  Ajuda a proteger alterações em registros financeiros que já fazem parte do histórico.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.require_delete_financial_record_confirmation}
                onChange={(e) =>
                  updateField('require_delete_financial_record_confirmation', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exigir confirmação reforçada ao apagar registro financeiro</p>
                <p className="text-xs text-gray-500 mt-1">
                  Recomendado para ações com impacto direto em cobranças, parcelas e rastreabilidade.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <TriangleAlert size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Orientação para ações sensíveis</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Defina se o sistema deve exibir alerta de atenção e qual mensagem base será usada nas confirmações futuras.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.show_sensitive_action_warning}
                onChange={(e) =>
                  updateField('show_sensitive_action_warning', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exibir alerta de ação sensível antes da confirmação</p>
                <p className="text-xs text-gray-500 mt-1">
                  Mantém preparada a camada extra de aviso para operações críticas.
                </p>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Texto interno de orientação para ações críticas
              </label>
              <textarea
                value={form.sensitive_action_guidance_text}
                onChange={(e) => updateField('sensitive_action_guidance_text', e.target.value)}
                rows={5}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                placeholder="Digite a orientação que será mostrada antes de confirmações críticas."
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Este texto será reaproveitado quando formos aplicar essas preferências nas telas de exclusão e edição sensível.
              </p>
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex gap-3">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={18} />}
            {saving ? 'Salvando...' : 'Salvar preferências'}
          </button>

          <button
            type="button"
            onClick={fetchSettings}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 font-semibold rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={18} />
            Recarregar dados
          </button>
        </div>
      </form>

      {canManageRoles && (
        <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
                <KeyRound size={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Cargos e permissões</h3>
                <p className="text-sm text-gray-500 mt-1 leading-6 max-w-3xl">
                  Crie cargos personalizados ou ajuste os cargos existentes. Nesta fase, ainda não
                  apagamos cargos; só criamos, atualizamos e ativamos/desativamos quando permitido.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={startNewRole}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                <PlusCircle size={16} />
                Novo cargo
              </button>

              <button
                type="button"
                onClick={() => fetchRoles()}
                disabled={rolesLoading || rolesSaving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-70"
              >
                {rolesLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                Atualizar cargos
              </button>
            </div>
          </div>

          {rolesError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{rolesError}</span>
            </div>
          )}

          {rolesSuccess && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex gap-3">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>{rolesSuccess}</span>
            </div>
          )}

          {rolesLoading ? (
            <div className="min-h-[220px] flex items-center justify-center">
              <div className="flex items-center gap-3 text-gray-600">
                <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">Carregando cargos...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-4 space-y-3">
                {roles.map((role) => {
                  const isSelected = roleForm.roleId === role.id;

                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => selectRole(role)}
                      className={`w-full text-left rounded-xl border p-4 transition-colors ${
                        isSelected
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{role.name}</p>
                          <p className="text-xs text-gray-500 mt-1">slug: {role.slug}</p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {role.is_system_role && (
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                              Sistema
                            </span>
                          )}

                          {!role.is_active && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                              Inativo
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-500 mt-3 leading-6">
                        {role.description || 'Sem descrição definida.'}
                      </p>

                      <p className="text-xs text-gray-400 mt-3">
                        Atualizado em {formatDateTime(role.updated_at)}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="xl:col-span-8 space-y-6">
                <div className="rounded-xl border p-4 md:p-5 bg-gray-50/60">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Nome do cargo
                      </label>
                      <input
                        type="text"
                        value={roleForm.name}
                        onChange={(e) => updateRoleField('name', e.target.value)}
                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        placeholder="Ex: Operacional de Cobrança"
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 w-full">
                        <input
                          type="checkbox"
                          checked={roleForm.isActive}
                          disabled={isSystemRole}
                          onChange={(e) => updateRoleField('isActive', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Cargo ativo</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {isSystemRole
                              ? 'Cargos de sistema permanecem ativos por segurança.'
                              : 'Cargos inativos não devem ser atribuídos a novos usuários.'}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Descrição
                    </label>
                    <textarea
                      value={roleForm.description}
                      onChange={(e) => updateRoleField('description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y bg-white"
                      placeholder="Descreva brevemente o objetivo deste cargo."
                    />
                  </div>

                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    Nesta etapa, o editor salva permissões e estado do cargo. O escopo financeiro será refinado em uma fase posterior.
                  </div>
                </div>

                <div className="space-y-4">
                  {permissionsByDomain.map((group) => (
                    <div key={group.domain} className="rounded-xl border p-4 md:p-5">
                      <h4 className="text-sm font-bold text-gray-900 mb-3">
                        {group.title}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.items.map((permission) => (
                          <label
                            key={permission.key}
                            className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={roleForm.permissions[permission.key]}
                              onChange={(e) =>
                                togglePermission(permission.key, e.target.checked)
                              }
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {permission.label}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 leading-5">
                                {permission.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleSaveRole}
                    disabled={rolesSaving}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {rolesSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={18} />}
                    {rolesSaving
                      ? 'Salvando cargo...'
                      : isCreatingNewRole
                      ? 'Criar cargo'
                      : 'Salvar cargo'}
                  </button>

                  {!isCreatingNewRole && (
                    <button
                      type="button"
                      onClick={() => selectedRole && selectRole(selectedRole)}
                      disabled={rolesSaving}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 font-semibold rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <RefreshCcw size={18} />
                      Desfazer edição local
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
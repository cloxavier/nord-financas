/**
 * Seção de Permissões e Segurança.
 * Nesta etapa:
 * - mantém preferências de confirmação
 * - mantém criação e edição de cargos
 * - adiciona exclusão segura de cargo customizado
 * - exige migração dos usuários vinculados antes da exclusão
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
  Trash2,
  Users,
} from 'lucide-react';

import {
  EMPTY_PERMISSION_SECURITY_SETTINGS,
  PermissionSecuritySettingsFormData,
  getPermissionSecuritySettings,
  savePermissionSecuritySettings,
} from '@/src/lib/appSettings';
import {
  deleteAccessRoleWithReassignment,
  listAllAccessRoles,
  previewAccessRoleDeletion,
  upsertAccessRoleDefinition,
  AccessRoleDeletionPreview,
} from '@/src/lib/accessManagement';
import { useAuth } from '@/src/contexts/AuthContext';
import { AccessRole } from '@/src/types/database';
import { formatDateTime } from '@/src/lib/utils';
import { FinancialScopeMap, normalizeFinancialScope, defaultFinancialScope } from '@/src/lib/financialScope';
import {
  getPermissionCatalog,
  PermissionDomain,
  PermissionKey,
} from '@/src/domain/access/catalog/permissionCatalog';
import { getFinancialScopeCatalog } from '@/src/domain/access/catalog/financialScopeCatalog';

const permissionCatalog = getPermissionCatalog();
const financialScopeCatalog = getFinancialScopeCatalog();

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
  financialScopeJson: FinancialScopeMap;
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
    financialScopeJson: { ...defaultFinancialScope },
  };
}

function buildRoleEditorStateFromRole(role: AccessRole): RoleEditorFormState {
  return {
    roleId: role.id,
    name: role.name || '',
    description: role.description || '',
    isActive: role.is_active,
    permissions: normalizePermissionMap(role.permissions_json),
    financialScopeJson: normalizeFinancialScope(role.financial_scope_json),
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
  const [rolesDeleting, setRolesDeleting] = useState(false);

  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [roleForm, setRoleForm] = useState<RoleEditorFormState>(
    createEmptyRoleEditorState()
  );

  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [rolesError, setRolesError] = useState('');
  const [rolesSuccess, setRolesSuccess] = useState('');

  const [deletePreview, setDeletePreview] = useState<AccessRoleDeletionPreview | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deleteAssignments, setDeleteAssignments] = useState<Record<string, string>>({});
  const [bulkTargetRoleId, setBulkTargetRoleId] = useState('');

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
        'Não foi possível carregar os cargos. Confirme se as migrations de cargos foram aplicadas corretamente no Supabase.'
      );
    } finally {
      setRolesLoading(false);
    }
  }

  function clearDeleteState() {
    setDeletePreview(null);
    setDeleteAssignments({});
    setBulkTargetRoleId('');
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

  function updateRoleFinancialScopeField<K extends keyof FinancialScopeMap>(
    field: K,
    value: FinancialScopeMap[K]
  ) {
    setRoleForm((prev) => ({
      ...prev,
      financialScopeJson: {
        ...prev.financialScopeJson,
        [field]: value,
      },
    }));
  }

  function selectRole(role: AccessRole) {
    setRolesError('');
    setRolesSuccess('');
    clearDeleteState();
    setRoleForm(buildRoleEditorStateFromRole(role));
  }

  function startNewRole() {
    setRolesError('');
    setRolesSuccess('');
    clearDeleteState();
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
      clearDeleteState();
    } catch (error: any) {
      console.error('Erro ao salvar cargo:', error);
      setRolesError(error.message || 'Não foi possível salvar o cargo.');
    } finally {
      setRolesSaving(false);
    }
  }

  async function handlePrepareDelete() {
    if (!roleForm.roleId) {
      setRolesError('Selecione um cargo antes de preparar a exclusão.');
      return;
    }

    setDeletePreviewLoading(true);
    setRolesError('');
    setRolesSuccess('');

    try {
      const preview = await previewAccessRoleDeletion(roleForm.roleId);
      setDeletePreview(preview);

      const initialAssignments: Record<string, string> = {};
      preview.assigned_users.forEach((user) => {
        initialAssignments[user.profile_id] = '';
      });
      setDeleteAssignments(initialAssignments);
      setBulkTargetRoleId('');
    } catch (error: any) {
      console.error('Erro ao preparar exclusão do cargo:', error);
      setRolesError(
        error.message || 'Não foi possível analisar o impacto da exclusão.'
      );
    } finally {
      setDeletePreviewLoading(false);
    }
  }

  function applyBulkTargetRole() {
    if (!bulkTargetRoleId || !deletePreview) return;

    const nextAssignments: Record<string, string> = {};
    deletePreview.assigned_users.forEach((user) => {
      nextAssignments[user.profile_id] = bulkTargetRoleId;
    });

    setDeleteAssignments(nextAssignments);
  }

  async function handleDeleteRole() {
    if (!deletePreview) {
      setRolesError('Prepare a exclusão do cargo antes de confirmar.');
      return;
    }

    if (deletePreview.is_system_role) {
      setRolesError('Cargos de sistema não podem ser excluídos.');
      return;
    }

    const reassignments = deletePreview.assigned_users.map((user) => ({
      profileId: user.profile_id,
      targetRoleId: deleteAssignments[user.profile_id] || '',
    }));

    if (
      deletePreview.assigned_users_count > 0 &&
      reassignments.some((item) => !item.targetRoleId)
    ) {
      setRolesError('Defina o cargo de destino para todos os usuários impactados.');
      return;
    }

    setRolesDeleting(true);
    setRolesError('');
    setRolesSuccess('');

    try {
      const result = await deleteAccessRoleWithReassignment({
        roleId: deletePreview.role_id,
        reassignments,
      });

      setRolesSuccess(
        `Cargo excluído com sucesso. Usuários migrados: ${result.migrated_users_count}.`
      );

      clearDeleteState();
      await fetchRoles();
      await refreshProfile();
    } catch (error: any) {
      console.error('Erro ao excluir cargo:', error);
      setRolesError(error.message || 'Não foi possível excluir o cargo.');
    } finally {
      setRolesDeleting(false);
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

  const availableMigrationRoles = useMemo(() => {
    if (!selectedRole) return roles.filter((role) => role.is_active);

    return roles.filter((role) => role.is_active && role.id !== selectedRole.id);
  }, [roles, selectedRole]);

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
                  Crie cargos personalizados, ajuste cargos existentes e exclua cargos customizados
                  de forma segura, com migração obrigatória dos usuários vinculados.
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
                disabled={rolesLoading || rolesSaving || rolesDeleting}
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

                  <div className="mt-4 rounded-xl border p-4 bg-white">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                        <Shield size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Escopo financeiro do cargo</h4>
                        <p className="text-xs text-gray-500 mt-1 leading-5">
                          Defina até onde este cargo pode ver valores, totais e previsões financeiras.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nível de acesso financeiro</label>
                        <select
                          value={roleForm.financialScopeJson.financial_access_level}
                          onChange={(e) => updateRoleFinancialScopeField('financial_access_level', e.target.value as FinancialScopeMap['financial_access_level'])}
                          className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                          {financialScopeCatalog.map((scope) => (
                            <option key={scope.key} value={scope.key}>
                              {scope.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Meses para trás</label>
                          <input
                            type="number"
                            min={0}
                            value={roleForm.financialScopeJson.months_back_visible}
                            onChange={(e) => updateRoleFinancialScopeField('months_back_visible', Math.max(0, Number(e.target.value) || 0))}
                            className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Meses para frente</label>
                          <input
                            type="number"
                            min={0}
                            value={roleForm.financialScopeJson.months_forward_visible}
                            onChange={(e) => updateRoleFinancialScopeField('months_forward_visible', Math.max(0, Number(e.target.value) || 0))}
                            className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={roleForm.financialScopeJson.can_view_open_amount_total}
                          onChange={(e) => updateRoleFinancialScopeField('can_view_open_amount_total', e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Pode ver totais em aberto</p>
                          <p className="text-xs text-gray-500 mt-1">Libera cartões e totais agregados de inadimplência e recebíveis.</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={roleForm.financialScopeJson.can_view_monthly_forecast}
                          onChange={(e) => updateRoleFinancialScopeField('can_view_monthly_forecast', e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Pode ver previsão mensal</p>
                          <p className="text-xs text-gray-500 mt-1">Prepara o cargo para análises futuras de horizonte financeiro.</p>
                        </div>
                      </label>
                    </div>
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
                    disabled={rolesSaving || rolesDeleting}
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
                      disabled={rolesSaving || rolesDeleting}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 font-semibold rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <RefreshCcw size={18} />
                      Desfazer edição local
                    </button>
                  )}

                  {!isCreatingNewRole && !isSystemRole && (
                    <button
                      type="button"
                      onClick={handlePrepareDelete}
                      disabled={rolesSaving || rolesDeleting || deletePreviewLoading}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {deletePreviewLoading ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                      Preparar exclusão
                    </button>
                  )}
                </div>

                {deletePreview && (
                  <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 md:p-6 space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                        <Trash2 size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-red-900">
                          Exclusão do cargo: {deletePreview.role_name}
                        </h4>
                        <p className="text-sm text-red-800 mt-1 leading-6">
                          Antes de excluir este cargo, revise os usuários impactados e defina o cargo de destino de cada um deles.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-red-200 bg-white px-4 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        Resumo do impacto
                      </p>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-lg border px-3 py-3">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                            Cargo
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {deletePreview.role_name}
                          </p>
                        </div>

                        <div className="rounded-lg border px-3 py-3">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                            Slug
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {deletePreview.role_slug}
                          </p>
                        </div>

                        <div className="rounded-lg border px-3 py-3">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                            Usuários vinculados
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {deletePreview.assigned_users_count}
                          </p>
                        </div>
                      </div>
                    </div>

                    {deletePreview.assigned_users_count > 0 ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
                          <Users size={18} className="mt-0.5 shrink-0" />
                          <span>
                            Este cargo está em uso. Para excluí-lo, é obrigatório migrar todos os usuários para outro cargo ativo.
                          </span>
                        </div>

                        <div className="rounded-lg border bg-white p-4">
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Aplicar o mesmo cargo para todos
                              </label>
                              <select
                                value={bulkTargetRoleId}
                                onChange={(e) => setBulkTargetRoleId(e.target.value)}
                                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              >
                                <option value="">Selecione um cargo de destino</option>
                                {availableMigrationRoles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={applyBulkTargetRole}
                              disabled={!bulkTargetRoleId}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 font-semibold rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-60"
                            >
                              Aplicar para todos
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {deletePreview.assigned_users.map((user) => (
                            <div
                              key={user.profile_id}
                              className="rounded-lg border bg-white p-4 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 items-start"
                            >
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {user.full_name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                                <p className="text-xs text-gray-500 mt-2">
                                  Status atual: <strong>{user.access_status}</strong>
                                </p>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                  Novo cargo
                                </label>
                                <select
                                  value={deleteAssignments[user.profile_id] || ''}
                                  onChange={(e) =>
                                    setDeleteAssignments((prev) => ({
                                      ...prev,
                                      [user.profile_id]: e.target.value,
                                    }))
                                  }
                                  className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                  <option value="">Selecione um cargo de destino</option>
                                  {availableMigrationRoles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                      {role.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        Este cargo não possui usuários vinculados. A exclusão pode ser feita diretamente.
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleDeleteRole}
                        disabled={rolesDeleting}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70"
                      >
                        {rolesDeleting ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                        {rolesDeleting
                          ? 'Excluindo cargo...'
                          : deletePreview.assigned_users_count > 0
                          ? 'Migrar usuários e excluir cargo'
                          : 'Excluir cargo'}
                      </button>

                      <button
                        type="button"
                        onClick={clearDeleteState}
                        disabled={rolesDeleting}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 font-semibold rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-70"
                      >
                        <RefreshCcw size={18} />
                        Cancelar exclusão
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
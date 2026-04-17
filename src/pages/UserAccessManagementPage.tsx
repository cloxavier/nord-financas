import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Search,
  Shield,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import { AccessRole, AccessStatus } from '../types/database';
import {
  listAllAccessRoles,
  listUserAccessOverview,
  updateUserAccessControl,
  UserAccessOverview,
} from '../lib/accessManagement';
import { cn, formatDate } from '../lib/utils';

type AccessFilter = 'all' | 'pending' | 'active' | 'blocked';

function getStatusLabel(status: AccessStatus) {
  if (status === 'pending') return 'Pendente';
  if (status === 'active') return 'Ativo';
  return 'Bloqueado';
}

function getStatusClasses(status: AccessStatus) {
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'active') return 'bg-green-50 text-green-700 border-green-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export default function UserAccessManagementPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserAccessOverview[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<AccessFilter>('pending');
  const [draftRoleByUser, setDraftRoleByUser] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  useEffect(() => {
    fetchPageData();
  }, []);

  async function fetchPageData() {
    setLoading(true);
    setPageError('');
    setPageSuccess('');

    try {
      const [usersData, rolesData] = await Promise.all([
        listUserAccessOverview(),
        listAllAccessRoles(),
      ]);

      setUsers(usersData);
      setRoles(rolesData);

      const initialDrafts: Record<string, string> = {};
      usersData.forEach((user) => {
        if (user.role_id) {
          initialDrafts[user.profile_id] = user.role_id;
        }
      });
      setDraftRoleByUser(initialDrafts);
    } catch (error: any) {
      console.error('Erro ao carregar administração de usuários:', error);
      setPageError(
        'Não foi possível carregar a administração de usuários. Confirme se o SQL da etapa de cargos foi executado corretamente.'
      );
    } finally {
      setLoading(false);
    }
  }

  function updateDraftRole(profileId: string, roleId: string) {
    setDraftRoleByUser((prev) => ({
      ...prev,
      [profileId]: roleId,
    }));
  }

  function getSelectedRole(roleId?: string | null) {
    if (!roleId) return null;
    return roles.find((role) => role.id === roleId) ?? null;
  }

  async function handleApprove(user: UserAccessOverview) {
    const selectedRoleId = draftRoleByUser[user.profile_id];
    const selectedRole = getSelectedRole(selectedRoleId);

    if (!selectedRoleId || !selectedRole) {
      setPageError(`Selecione um cargo antes de aprovar ${user.full_name}.`);
      setPageSuccess('');
      return;
    }

    if (!selectedRole.is_active) {
      setPageError(`O cargo selecionado para ${user.full_name} está inativo.`);
      setPageSuccess('');
      return;
    }

    setBusyUserId(user.profile_id);
    setPageError('');
    setPageSuccess('');

    try {
      await updateUserAccessControl({
        profileId: user.profile_id,
        roleId: selectedRoleId,
        accessStatus: 'active',
      });

      setPageSuccess(`Usuário ${user.full_name} aprovado com sucesso.`);
      await fetchPageData();
    } catch (error: any) {
      console.error('Erro ao aprovar usuário:', error);
      setPageError(error.message || `Não foi possível aprovar ${user.full_name}.`);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleBlock(user: UserAccessOverview) {
    setBusyUserId(user.profile_id);
    setPageError('');
    setPageSuccess('');

    try {
      await updateUserAccessControl({
        profileId: user.profile_id,
        roleId: draftRoleByUser[user.profile_id] || user.role_id,
        accessStatus: 'blocked',
      });

      setPageSuccess(`Usuário ${user.full_name} bloqueado com sucesso.`);
      await fetchPageData();
    } catch (error: any) {
      console.error('Erro ao bloquear usuário:', error);
      setPageError(error.message || `Não foi possível bloquear ${user.full_name}.`);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleReactivate(user: UserAccessOverview) {
    const selectedRoleId = draftRoleByUser[user.profile_id] || user.role_id;
    const selectedRole = getSelectedRole(selectedRoleId);

    if (!selectedRoleId || !selectedRole) {
      setPageError(`Selecione um cargo antes de reativar ${user.full_name}.`);
      setPageSuccess('');
      return;
    }

    if (!selectedRole.is_active) {
      setPageError(`O cargo selecionado para ${user.full_name} está inativo.`);
      setPageSuccess('');
      return;
    }

    setBusyUserId(user.profile_id);
    setPageError('');
    setPageSuccess('');

    try {
      await updateUserAccessControl({
        profileId: user.profile_id,
        roleId: selectedRoleId,
        accessStatus: 'active',
      });

      setPageSuccess(`Usuário ${user.full_name} reativado com sucesso.`);
      await fetchPageData();
    } catch (error: any) {
      console.error('Erro ao reativar usuário:', error);
      setPageError(error.message || `Não foi possível reativar ${user.full_name}.`);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleSaveRole(user: UserAccessOverview) {
    const selectedRoleId = draftRoleByUser[user.profile_id];
    const selectedRole = getSelectedRole(selectedRoleId);

    if (!selectedRoleId || !selectedRole) {
      setPageError(`Selecione um cargo para ${user.full_name}.`);
      setPageSuccess('');
      return;
    }

    if (!selectedRole.is_active) {
      setPageError(`Não é possível atribuir um cargo inativo para ${user.full_name}.`);
      setPageSuccess('');
      return;
    }

    setBusyUserId(user.profile_id);
    setPageError('');
    setPageSuccess('');

    try {
      await updateUserAccessControl({
        profileId: user.profile_id,
        roleId: selectedRoleId,
        accessStatus: user.access_status,
      });

      setPageSuccess(`Cargo de ${user.full_name} atualizado com sucesso.`);
      await fetchPageData();
    } catch (error: any) {
      console.error('Erro ao atualizar cargo:', error);
      setPageError(error.message || `Não foi possível atualizar o cargo de ${user.full_name}.`);
    } finally {
      setBusyUserId(null);
    }
  }

  const counts = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.all += 1;
        acc[user.access_status] += 1;
        return acc;
      },
      { all: 0, pending: 0, active: 0, blocked: 0 }
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesFilter = filter === 'all' ? true : user.access_status === filter;
      if (!matchesFilter) return false;

      const base = `${user.full_name} ${user.email} ${user.role_name || ''}`.toLowerCase();
      return base.includes(searchTerm.toLowerCase());
    });
  }, [users, filter, searchTerm]);

  function renderFilterButton(label: string, value: AccessFilter, count: number) {
    const isActive = filter === value;

    return (
      <button
        type="button"
        onClick={() => setFilter(value)}
        className={cn(
          'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border',
          isActive
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        )}
      >
        {label} ({count})
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500">
            Aprove, bloqueie e atribua cargos aos usuários que acessam o sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPageData}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
        >
          <RefreshCcw size={16} />
          Atualizar lista
        </button>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-blue-700 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-900 leading-6">
            Nesta fase, o gestor já consegue aprovar usuários, bloquear acessos, atribuir cargos
            padrão e também trabalhar com cargos personalizados criados na área de Permissões e Segurança.
          </p>
        </div>
      </div>

      {pageSuccess && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex gap-3">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{pageSuccess}</span>
        </div>
      )}

      {pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {renderFilterButton('Todos', 'all', counts.all)}
            {renderFilterButton('Pendentes', 'pending', counts.pending)}
            {renderFilterButton('Ativos', 'active', counts.active)}
            {renderFilterButton('Bloqueados', 'blocked', counts.blocked)}
          </div>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Cadastro
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const selectedRoleId = draftRoleByUser[user.profile_id] || '';
                  const selectedRole = getSelectedRole(selectedRoleId);
                  const isBusy = busyUserId === user.profile_id;

                  return (
                    <tr key={user.profile_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {user.full_name}
                            {user.is_me ? (
                              <span className="ml-2 text-xs font-semibold text-blue-600">
                                (você)
                              </span>
                            ) : null}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                          {user.approved_by_name && user.approved_at ? (
                            <p className="text-xs text-gray-400 mt-2">
                              Aprovado por {user.approved_by_name} em {formatDate(user.approved_at)}
                            </p>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border',
                            getStatusClasses(user.access_status)
                          )}
                        >
                          {getStatusLabel(user.access_status)}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top min-w-[280px]">
                        <select
                          value={selectedRoleId}
                          onChange={(e) => updateDraftRole(user.profile_id, e.target.value)}
                          className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                        >
                          <option value="">Selecione um cargo</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                              {role.is_active ? '' : ' (inativo)'}
                            </option>
                          ))}
                        </select>

                        <div className="mt-2 text-xs text-gray-500">
                          {selectedRole ? (
                            <>
                              <span className="font-semibold text-gray-700">
                                slug:
                              </span>{' '}
                              {selectedRole.slug}
                              {!selectedRole.is_active ? (
                                <span className="ml-2 font-semibold text-red-600">
                                  Cargo inativo
                                </span>
                              ) : null}
                            </>
                          ) : (
                            'Selecione um cargo para este usuário.'
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <p className="text-sm text-gray-700">{formatDate(user.created_at)}</p>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {user.access_status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleApprove(user)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-70"
                            >
                              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                              Aprovar
                            </button>
                          )}

                          {user.access_status === 'active' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveRole(user)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-70"
                              >
                                {isBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                                Salvar cargo
                              </button>

                              <button
                                type="button"
                                onClick={() => handleBlock(user)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-70"
                              >
                                {isBusy ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
                                Bloquear
                              </button>
                            </>
                          )}

                          {user.access_status === 'blocked' && (
                            <button
                              type="button"
                              onClick={() => handleReactivate(user)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-70"
                            >
                              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                              Reativar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nenhum usuário encontrado com esse filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden divide-y">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => {
              const selectedRoleId = draftRoleByUser[user.profile_id] || '';
              const selectedRole = getSelectedRole(selectedRoleId);
              const isBusy = busyUserId === user.profile_id;

              return (
                <div key={user.profile_id} className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {user.full_name}
                        {user.is_me ? (
                          <span className="ml-2 text-xs font-semibold text-blue-600">
                            (você)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                    </div>

                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border',
                        getStatusClasses(user.access_status)
                      )}
                    >
                      {getStatusLabel(user.access_status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Cargo
                      </label>
                      <select
                        value={selectedRoleId}
                        onChange={(e) => updateDraftRole(user.profile_id, e.target.value)}
                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                      >
                        <option value="">Selecione um cargo</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                            {role.is_active ? '' : ' (inativo)'}
                          </option>
                        ))}
                      </select>

                      <p className="text-xs text-gray-500 mt-2">
                        {selectedRole ? `slug: ${selectedRole.slug}` : 'Selecione um cargo.'}
                      </p>
                    </div>

                    <div className="text-xs text-gray-500">
                      Cadastrado em {formatDate(user.created_at)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {user.access_status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(user)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-70"
                      >
                        {isBusy ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                        Aprovar
                      </button>
                    )}

                    {user.access_status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSaveRole(user)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-70"
                        >
                          {isBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                          Salvar cargo
                        </button>

                        <button
                          type="button"
                          onClick={() => handleBlock(user)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-70"
                        >
                          {isBusy ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
                          Bloquear
                        </button>
                      </>
                    )}

                    {user.access_status === 'blocked' && (
                      <button
                        type="button"
                        onClick={() => handleReactivate(user)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-70"
                      >
                        {isBusy ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                        Reativar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-gray-500">
              Nenhum usuário encontrado com esse filtro.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Users size={18} className="text-gray-500 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-600 leading-6">
            Total de usuários listados: <strong>{filteredUsers.length}</strong>. Cargos inativos podem continuar
            vinculados a usuários antigos, mas não devem ser usados em novas aprovações ou reativações.
          </p>
        </div>
      </div>
    </div>
  );
}
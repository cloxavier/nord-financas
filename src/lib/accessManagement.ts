/**
 * Camada de acesso para administração de usuários e cargos.
 * Centraliza:
 * - leitura de usuários e cargos
 * - troca de cargo/status do usuário
 * - criação e edição da definição de cargos
 *
 * Esta versão foi alinhada com a migration já aplicada:
 * 2026-04-017_access_role_editor_and_upsert.sql
 */

import { supabase } from './supabase';
import { AccessRole, AccessStatus } from '../types/database';

export interface UserAccessOverview {
  profile_id: string;
  full_name: string;
  email: string;
  access_status: AccessStatus;
  role_id: string | null;
  role_name: string | null;
  role_slug: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  is_me: boolean;
}

export interface AccessRoleUpsertInput {
  roleId?: string | null;
  name: string;
  description?: string | null;
  isActive: boolean;
  permissionsJson: Record<string, boolean>;
  financialScopeJson: Record<string, boolean>;
}

export interface AccessRoleUpsertResult {
  role_id: string;
  role_slug: string;
  updated_at: string | null;
}

export async function listUserAccessOverview(): Promise<UserAccessOverview[]> {
  const { data, error } = await supabase.rpc('list_user_access_overview');

  if (error) throw error;
  return (data || []) as UserAccessOverview[];
}

export async function listActiveAccessRoles(): Promise<AccessRole[]> {
  const { data, error } = await supabase
    .from('access_roles')
    .select('*')
    .eq('is_active', true)
    .order('is_system_role', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as AccessRole[];
}

export async function listAllAccessRoles(): Promise<AccessRole[]> {
  const { data, error } = await supabase
    .from('access_roles')
    .select('*')
    .order('is_system_role', { ascending: false })
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as AccessRole[];
}

export async function updateUserAccessControl(params: {
  profileId: string;
  roleId: string | null;
  accessStatus: AccessStatus;
}) {
  const { error } = await supabase.rpc('update_user_access_control', {
    p_profile_id: params.profileId,
    p_role_id: params.roleId,
    p_access_status: params.accessStatus,
  });

  if (error) throw error;
}

export async function upsertAccessRoleDefinition(
  params: AccessRoleUpsertInput
): Promise<AccessRoleUpsertResult> {
  const { data, error } = await supabase
    .rpc('upsert_access_role_definition', {
      p_role_id: params.roleId ?? null,
      p_name: params.name,
      p_description: params.description ?? null,
      p_is_active: params.isActive,
      p_permissions_json: params.permissionsJson,
      p_financial_scope_json: params.financialScopeJson,
    })
    .single();

  if (error) throw error;

  return data as AccessRoleUpsertResult;
}
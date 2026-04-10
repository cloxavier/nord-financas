/**
 * Camada de acesso para administração de usuários.
 * Centraliza as chamadas RPC e consultas de cargos ativos.
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
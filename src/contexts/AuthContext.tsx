/**
 * Contexto de Autenticação.
 * Agora além do status e cargo, o contexto já expõe permissões do cargo.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AccessStatus, Profile } from '../types/database';
import {
  PermissionKey,
  PermissionMap,
  hasPermission as checkPermission,
  normalizePermissions,
} from '../lib/permissions';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  accessStatus: AccessStatus | null;
  roleName: string;
  roleSlug: string | null;
  permissions: PermissionMap;
  hasPermission: (key: PermissionKey) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getLegacyRoleLabel(role: Profile['role']): string {
  switch (role) {
    case 'admin':
      return 'Gestor';
    case 'financeiro':
      return 'Financeiro';
    case 'dentista':
      return 'Dentista';
    case 'recepcao':
      return 'Secretária';
    default:
      return 'Sem cargo definido';
  }
}

function getLegacyRoleSlug(role: Profile['role']): string | null {
  switch (role) {
    case 'admin':
      return 'gestor';
    case 'financeiro':
      return 'financeiro';
    case 'dentista':
      return 'dentista';
    case 'recepcao':
      return 'secretaria';
    default:
      return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          access_status,
          role_id,
          approved_by,
          approved_at,
          created_at,
          updated_at,
          access_role:access_roles (
            id,
            name,
            slug,
            description,
            is_system_role,
            is_active,
            permissions_json,
            financial_scope_json,
            created_at,
            updated_at
          )
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setProfile(null);
        return;
      }

      const resolvedRoleName = data.access_role?.name || getLegacyRoleLabel(data.role);
      const resolvedRoleSlug = data.access_role?.slug || getLegacyRoleSlug(data.role);

      const normalizedProfile: Profile = {
        ...data,
        access_role: data.access_role ?? null,
        resolved_role_name: resolvedRoleName,
        resolved_role_slug: resolvedRoleSlug,
      };

      setProfile(normalizedProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        setLoading(true);
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    setLoading(true);
    await fetchProfile(user.id);
  }, [fetchProfile, user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const accessStatus = useMemo<AccessStatus | null>(() => {
    if (!user) return null;
    return profile?.access_status ?? 'pending';
  }, [profile, user]);

  const roleName = useMemo(() => {
    if (!profile) return 'Sem cargo definido';
    return profile.resolved_role_name || 'Sem cargo definido';
  }, [profile]);

  const roleSlug = useMemo(() => {
    if (!profile) return null;
    return profile.resolved_role_slug || null;
  }, [profile]);

  const permissions = useMemo<PermissionMap>(() => {
    return normalizePermissions(profile?.access_role?.permissions_json);
  }, [profile]);

  const hasPermission = useCallback(
    (key: PermissionKey) => checkPermission(permissions, key),
    [permissions]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        accessStatus,
        roleName,
        roleSlug,
        permissions,
        hasPermission,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
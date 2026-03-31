/**
 * Contexto de Autenticação.
 * Este arquivo gerencia o estado global de autenticação do usuário, integrando-se com o Supabase Auth.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/database';

/**
 * Interface que define a estrutura do valor do contexto de autenticação.
 */
interface AuthContextType {
  user: User | null;       // Dados básicos do usuário autenticado no Supabase
  profile: Profile | null; // Perfil detalhado do usuário (da tabela 'profiles')
  loading: boolean;        // Estado de carregamento inicial da autenticação
  signOut: () => Promise<void>; // Função para deslogar o usuário
}

/**
 * Criação do contexto de autenticação.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provedor de Autenticação (AuthProvider).
 * Envolve a aplicação para fornecer acesso ao estado de autenticação.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Obtém a sessão atual ao carregar o componente.
     */
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    /**
     * Escuta mudanças no estado de autenticação (login, logout).
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Limpeza da inscrição ao desmontar o componente
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Busca os dados do perfil do usuário na tabela 'profiles'.
   * @param userId ID do usuário no Supabase Auth.
   */
  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Realiza o logout do usuário no Supabase.
   */
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    // Disponibiliza as informações de autenticação para os componentes filhos
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook personalizado para acessar o contexto de autenticação de forma simplificada.
 * @throws Erro se usado fora de um AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

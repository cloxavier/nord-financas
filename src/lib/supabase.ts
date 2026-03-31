/**
 * Configuração do cliente Supabase.
 * Este arquivo inicializa a conexão com o backend Supabase usando as variáveis de ambiente.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Obtém a URL do projeto Supabase das variáveis de ambiente.
 * Tenta obter de import.meta.env (Vite) ou process.env (Node/outros).
 */
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || (process.env.VITE_SUPABASE_URL as string);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || (process.env.VITE_SUPABASE_ANON_KEY as string);

/**
 * Validação: Garante que as variáveis necessárias estejam presentes.
 * Caso contrário, a aplicação não conseguirá se comunicar com o banco de dados.
 */
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Exporta a instância do cliente Supabase para ser usada em toda a aplicação.
 * Esta instância permite realizar operações de CRUD, autenticação e tempo real.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

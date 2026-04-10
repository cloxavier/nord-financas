/**
 * Tela exibida para usuários bloqueados.
 * Nesta etapa, o sistema impede o acesso ao app principal e informa o usuário.
 */

import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';

export default function BlockedAccessPage() {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-lg">
        <div className="bg-white border shadow-sm rounded-2xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert size={28} />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Acesso bloqueado</h1>
            <p className="text-gray-600 mt-3 leading-7">
              Sua conta está bloqueada no momento e não pode acessar o sistema.
              Caso acredite que isso seja um engano, entre em contato com o gestor responsável.
            </p>
          </div>

          <div className="mt-6 rounded-xl border bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              <strong>Nome:</strong> {profile?.full_name || 'Usuário'}
            </p>
            <p className="text-sm text-gray-700 mt-2">
              <strong>Status atual:</strong> bloqueado
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={handleSignOut}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 rounded-lg border font-semibold hover:bg-gray-50 transition-colors"
            >
              <LogOut size={18} />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
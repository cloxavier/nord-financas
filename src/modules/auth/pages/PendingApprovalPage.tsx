/**
 * Tela exibida para usuários autenticados que ainda aguardam liberação.
 * Nesta etapa, o usuário já consegue entrar com a conta,
 * mas não acessa o sistema principal até ser aprovado.
 */

import React, { useState } from 'react';
import { CheckCircle2, Clock3, LogOut, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';

export default function PendingApprovalPage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-lg">
        <div className="bg-white border shadow-sm rounded-2xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-5">
            <Clock3 size={28} />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Aguardando liberação</h1>
            <p className="text-gray-600 mt-3 leading-7">
              Sua conta foi criada com sucesso, mas ainda precisa ser aprovada por um gestor da clínica
              antes de acessar o sistema.
            </p>
          </div>

          <div className="mt-6 rounded-xl border bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              <strong>Nome:</strong> {profile?.full_name || 'Usuário'}
            </p>
            <p className="text-sm text-gray-700 mt-2">
              <strong>Status atual:</strong> aguardando aprovação
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-900 leading-6">
                Assim que o acesso for liberado, clique em <strong>Verificar novamente</strong>.
                Se a aprovação já tiver sido feita, você será redirecionado automaticamente.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-70"
            >
              <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Verificando...' : 'Verificar novamente'}
            </button>

            <button
              onClick={handleSignOut}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 rounded-lg border font-semibold hover:bg-gray-50 transition-colors"
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
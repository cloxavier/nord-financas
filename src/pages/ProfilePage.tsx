import React from 'react';
import { User, Mail, Shield, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function getAccessStatusLabel(status: string | null | undefined) {
  if (status === 'active') return 'Acesso ativo';
  if (status === 'pending') return 'Aguardando aprovação';
  if (status === 'blocked') return 'Acesso bloqueado';
  return 'Status indefinido';
}

function getAccessStatusBadgeClasses(status: string | null | undefined) {
  if (status === 'active') return 'bg-blue-50 text-blue-700';
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  if (status === 'blocked') return 'bg-red-50 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

export default function ProfilePage() {
  const { profile, user, roleName, accessStatus } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-500">Gerencie suas informações pessoais e segurança.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-xl border shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-4xl font-bold border-4 border-white shadow-md">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>

              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold text-gray-900">{profile?.full_name}</h2>
                <p className="text-gray-500">{roleName}</p>

                <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded uppercase ${getAccessStatusBadgeClasses(accessStatus)}`}
                  >
                    {getAccessStatusLabel(accessStatus)}
                  </span>

                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded uppercase">
                    ID: {user?.id.slice(0, 8)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    defaultValue={profile?.full_name}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    disabled
                    defaultValue={user?.email}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t">
              <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
                Atualizar Perfil
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-xl border shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <Key size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Alterar Senha</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
                <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="mt-6">
              <button className="px-6 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Redefinir Senha
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Shield size={18} className="text-blue-600" />
              Seu Acesso
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Cargo atual</span>
                <span className="text-gray-900 font-semibold">{roleName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <span className="text-gray-900 font-semibold">{getAccessStatusLabel(accessStatus)}</span>
              </div>
            </div>

            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700 leading-relaxed">
                Seu acesso atual está vinculado ao cargo <strong>{roleName}</strong>. As permissões
                e restrições podem variar conforme as políticas definidas pela clínica.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
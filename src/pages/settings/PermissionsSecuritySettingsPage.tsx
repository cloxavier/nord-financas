/**
 * Seção de Permissões e Segurança.
 * Traduz um conceito técnico para linguagem de negócio, preparando a área para regras de acesso futuras.
 */
import React from 'react';
import { Shield, LockKeyhole, TriangleAlert } from 'lucide-react';

export default function PermissionsSecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Permissões e Segurança</h2>
        <p className="text-sm text-gray-500 mt-1">
          Organize o que cada perfil pode fazer e quais ações exigem mais cuidado no sistema.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Shield size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Linguagem clara para o usuário</h3>
            <p className="text-sm text-gray-600 mt-1 leading-6 max-w-2xl">
              O antigo nome técnico foi substituído por uma abordagem mais compreensível,
              focada em acesso, proteção dos dados e ações sensíveis do sistema.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
              <LockKeyhole size={16} className="text-blue-600" />
              Ações sensíveis previstas
            </div>
            <ul className="space-y-2 text-sm text-gray-600 leading-6">
              <li>• Excluir tratamento</li>
              <li>• Excluir paciente</li>
              <li>• Alterar pagamento já lançado</li>
            </ul>
          </div>

          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
              <TriangleAlert size={16} className="text-amber-600" />
              Próxima implementação
            </div>
            <p className="text-sm text-gray-600 leading-6">
              Na próxima fase, esta área receberá controles reais de acesso por perfil e regras adicionais
              de confirmação para operações críticas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
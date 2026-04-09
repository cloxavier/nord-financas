/**
 * Seção de Notificações.
 * A tela prepara a estrutura para alertas internos e cobrança assistida por WhatsApp,
 * sem ainda criar automações externas nesta fase.
 */
import React from 'react';
import { Bell, MessageCircle, Clock3 } from 'lucide-react';

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Notificações</h2>
        <p className="text-sm text-gray-500 mt-1">
          Espaço reservado para preferências de alertas internos e ações rápidas de cobrança.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-5 space-y-3">
          <div className="flex items-center gap-3 text-gray-900 font-semibold">
            <Bell size={18} className="text-blue-600" />
            Alertas internos previstos
          </div>
          <ul className="space-y-2 text-sm text-gray-600 leading-6">
            <li>• Antecedência de vencimento configurável</li>
            <li>• Destaque para parcelas vencidas</li>
            <li>• Resumo de alertas no dashboard</li>
          </ul>
        </div>

        <div className="rounded-xl border bg-white p-5 space-y-3">
          <div className="flex items-center gap-3 text-gray-900 font-semibold">
            <MessageCircle size={18} className="text-emerald-600" />
            Cobrança assistida por WhatsApp
          </div>
          <ul className="space-y-2 text-sm text-gray-600 leading-6">
            <li>• Texto padrão de lembrete</li>
            <li>• Texto padrão de atraso</li>
            <li>• Ação rápida de abrir WhatsApp com mensagem pronta</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900 leading-6 flex gap-3">
        <Clock3 size={18} className="mt-0.5 shrink-0" />
        Nesta fase, a tela organiza o produto e elimina item sem função. A configuração funcional
        dos alertas será implementada na etapa seguinte.
      </div>
    </div>
  );
}
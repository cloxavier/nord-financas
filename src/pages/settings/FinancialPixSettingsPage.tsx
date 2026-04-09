/**
 * Seção Financeiro & Pix.
 * Nesta fase, a tela existe para eliminar item morto na navegação e alinhar o produto,
 * deixando clara a implementação planejada para a próxima etapa.
 */
import React from 'react';
import { CreditCard, ArrowRight } from 'lucide-react';

export default function FinancialPixSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Financeiro & Pix</h2>
        <p className="text-sm text-gray-500 mt-1">
          Esta área já está estruturada para receber as configurações financeiras na próxima fase.
        </p>
      </div>

      <div className="border rounded-xl bg-blue-50/40 border-blue-100 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white text-blue-600 flex items-center justify-center shadow-sm border border-blue-100">
            <CreditCard size={22} />
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Estrutura pronta para a Fase 1.2</h3>
              <p className="text-sm text-gray-600 mt-1 leading-6 max-w-2xl">
                Aqui vamos centralizar chave Pix, nome do recebedor, instruções padrão de pagamento
                e observações usadas em cobranças e recibos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
              <div className="rounded-lg bg-white border border-blue-100 px-4 py-3">Tipo de chave Pix</div>
              <div className="rounded-lg bg-white border border-blue-100 px-4 py-3">Chave Pix da clínica</div>
              <div className="rounded-lg bg-white border border-blue-100 px-4 py-3">Nome do recebedor</div>
              <div className="rounded-lg bg-white border border-blue-100 px-4 py-3">Instrução padrão de pagamento</div>
            </div>

            <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
              <ArrowRight size={16} />
              Pronto para receber implementação funcional na próxima etapa.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
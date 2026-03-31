/**
 * Página de Configurações do Sistema.
 * Permite ajustar preferências da clínica, dados financeiros, notificações e segurança.
 * Atualmente funciona como uma interface estática para futuras implementações de personalização.
 */
import React from 'react';
import { Settings, Building2, CreditCard, Shield, Bell } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500">Ajuste as preferências do sistema e dados da clínica.</p>
        </div>
      </div>

      {/* Container Principal das Configurações */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 min-h-[500px]">
          {/* Barra Lateral de Navegação das Configurações */}
          <div className="bg-gray-50 border-r p-4 space-y-1">
            {/* Botão: Dados da Clínica (Ativo por padrão) */}
            <button className="w-full flex items-center gap-3 px-3 py-2 bg-white text-blue-600 font-bold rounded-lg border shadow-sm">
              <Building2 size={18} />
              <span className="text-sm">Dados da Clínica</span>
            </button>
            {/* Botão: Financeiro & PIX */}
            <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <CreditCard size={18} />
              <span className="text-sm">Financeiro & PIX</span>
            </button>
            {/* Botão: Notificações */}
            <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell size={18} />
              <span className="text-sm">Notificações</span>
            </button>
            {/* Botão: Segurança & RLS */}
            <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Shield size={18} />
              <span className="text-sm">Segurança & RLS</span>
            </button>
          </div>

          {/* Conteúdo da Seção Selecionada (Dados da Clínica) */}
          <div className="md:col-span-3 p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Dados da Clínica</h3>
            <div className="space-y-6 max-w-2xl">
              {/* Campos de Identificação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Clínica</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nord Odontologia" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ / CPF</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="00.000.000/0001-00" />
                </div>
              </div>
              {/* Campo de Endereço */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Rua Exemplo, 123 - Centro" />
              </div>
              {/* Campos de Contato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="(11) 4002-8922" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de Contato</label>
                  <input type="email" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="contato@nord.com" />
                </div>
              </div>
              {/* Ação de Salvar */}
              <div className="pt-4">
                <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

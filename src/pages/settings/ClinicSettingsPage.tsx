/**
 * Seção de Dados da Clínica.
 * Mantém a interface já conhecida e preserva o comportamento visual atual.
 */
import React from 'react';

export default function ClinicSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Dados da Clínica</h2>
        <p className="text-sm text-gray-500 mt-1">
          Centralize as informações institucionais e de contato usadas no sistema.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Campos principais de identificação da clínica */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Clínica</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nord Odontologia"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ / CPF</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="00.000.000/0001-00"
            />
          </div>
        </div>

        {/* Campo de endereço completo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Rua Exemplo, 123 - Centro"
          />
        </div>

        {/* Campos de contato */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="(11) 4002-8922"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de Contato</label>
            <input
              type="email"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="contato@nord.com"
            />
          </div>
        </div>

        {/* Botão mantido como referência visual até a implementação da persistência */}
        <div className="pt-4">
          <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
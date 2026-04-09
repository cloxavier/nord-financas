/**
 * Layout principal da área de Configurações.
 * Nesta fase, o objetivo é organizar navegação, nomenclatura e rotas sem ainda implementar
 * toda a lógica de persistência das próximas subáreas.
 */
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { settingsSections } from '@/src/pages/settings/settingsSections';
import { cn } from '@/src/lib/utils';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho da área de Configurações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500">
            Organize os dados da clínica, futuras preferências financeiras, alertas e regras de acesso.
          </p>
        </div>
      </div>

      {/* Estrutura principal com navegação lateral e área de conteúdo */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 min-h-[560px]">
          <aside className="bg-gray-50 border-r p-4 space-y-1">
            <div className="flex items-center gap-3 px-3 py-2.5 mb-3 rounded-lg bg-white border shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Settings size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Área de Configurações</p>
                <p className="text-xs text-gray-500">Navegação organizada por módulo</p>
              </div>
            </div>

            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <NavLink
                  key={section.key}
                  to={section.path}
                  className={({ isActive }) => cn(
                    'w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-colors border',
                    isActive
                      ? 'bg-white text-blue-600 border-blue-100 shadow-sm'
                      : 'text-gray-600 border-transparent hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon size={18} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold leading-5">{section.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-4">{section.description}</p>
                  </div>
                </NavLink>
              );
            })}
          </aside>

          <section className="md:col-span-3 p-5 md:p-8 bg-white">
            {/* O conteúdo específico de cada subseção é renderizado aqui pelas rotas filhas. */}
            <Outlet />
          </section>
        </div>
      </div>
    </div>
  );
}
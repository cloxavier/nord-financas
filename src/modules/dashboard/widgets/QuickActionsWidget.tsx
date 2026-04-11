import React from 'react';
import { Link } from 'react-router-dom';

export default function QuickActionsWidget() {
  return (
    <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
      <h3 className="font-bold text-lg mb-2">Ações Rápidas</h3>
      <p className="text-blue-100 text-sm mb-6">
        Agilize o atendimento e controle financeiro da sua clínica.
      </p>

      <div className="space-y-3">
        <Link
          to="/pacientes/novo"
          className="block w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold text-center transition-colors"
        >
          Novo Paciente
        </Link>

        <Link
          to="/tratamentos/novo"
          className="block w-full py-2 px-4 bg-white text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-bold text-center transition-colors"
        >
          Novo Tratamento
        </Link>
      </div>
    </div>
  );
}
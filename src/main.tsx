/**
 * Arquivo de entrada principal da aplicação React.
 * Este arquivo é responsável por inicializar o React e renderizar o componente raiz no DOM.
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Cria a raiz do React usando o elemento HTML com ID 'root'.
 * O operador '!' é usado para garantir ao TypeScript que o elemento existe.
 * O método render inicializa a aplicação dentro do StrictMode para ajudar a identificar problemas potenciais.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Componente principal que contém toda a lógica de roteamento e estrutura da aplicação */}
    <App />
  </StrictMode>,
);

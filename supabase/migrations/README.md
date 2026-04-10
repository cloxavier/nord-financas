# Supabase Migrations - Nord Finanças

## Importante
Os arquivos `supabase_schema.sql` e `supabase_functions.sql` são arquivos legados.
Eles NÃO representam sozinhos o estado atual do banco.

## Estado atual do banco
O banco em produção recebeu alterações adicionais manualmente via SQL Editor do Supabase.

## Fonte correta para evolução
Considere como fonte de verdade:
1. arquivos legados iniciais
2. migrations desta pasta, em ordem cronológica

## Regra do projeto
Toda mudança futura de banco aplicada no Supabase deve também gerar um arquivo SQL nesta pasta.

## Observação
As migrations desta pasta servem para versionamento do projeto.
Elas não devem ser executadas em produção novamente sem análise prévia.
# Plano de tarefas — salvamento automático das configurações

[x] 1. Revisar o checklist, a documentação, os campos, o fluxo de persistência e o esquema Supabase existente.
[x] 2. Salvar automaticamente os parâmetros no cache protegido e confirmar cada gravação no Supabase.
[x] 3. Buscar a versão atual ao abrir a página e sincronizar snapshots em tempo real, preservando edições locais pendentes em conflitos.
[x] 4. Ajustar o indicador de estado, o salvamento manual, as tentativas após reconexão e os fluxos de backup/restauração.
[x] 5. Habilitar, de forma aditiva, a tabela de snapshots existente na publicação de atualizações em tempo real.
[x] 6. Verificar os tipos: zero diagnósticos. Registrar as alterações no checklist.
[ ] 7. Confirmar em dois dispositivos que as alterações permanecem após recarregar e sincronizam entre sessões.

Não foram criadas tabelas nem executados comandos de terminal. A validação real entre dispositivos depende da aplicação de `supabase_global_part3.sql` e do acesso a duas sessões do sistema.

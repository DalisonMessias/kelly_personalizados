# Plano de tarefas — ações no histórico de backups

[x] 1. Revisar checklist, documentação, tabela existente e função de backups.
[x] 2. Adicionar a marca de arquivamento e o índice ao esquema existente, preservando todas as linhas e o conteúdo das cópias (`supabase/migrations/supabase_global_part3.sql`).
[x] 3. Atualizar a função protegida para ocultar cópias arquivadas, bloquear sua leitura pelo histórico e arquivar sem apagar (`supabase/functions/system-backup/index.ts`).
[x] 4. Reutilizar a leitura e a validação existentes para baixar cópias do histórico (`src/services/systemBackupService.ts`).
[x] 5. Adicionar Baixar e Excluir ao lado de Restaurar, com confirmação personalizada e retorno visual (`src/components/settings/SettingsPage.tsx`).
[x] 6. Registrar a conclusão no checklist acumulado (`checklist.txt`).

A ação Excluir retira a cópia da lista visível e preserva seus dados. Para ativar a alteração no ambiente online, ainda é necessário aplicar o esquema e publicar a função atualizada no Supabase.

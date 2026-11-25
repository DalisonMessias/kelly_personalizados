# Plano de tarefas — Criador de Produtos com IA

[x] 1. Revisar checklist, documentação, Assistente IA, API atual, modelos do catálogo, sincronização Supabase e migrações existentes.
[x] 2. Confirmar que o catálogo é persistido como snapshots Supabase, que a tabela `api_keys` não está definida nos arquivos globais atuais e que a integração local de IA usa Groq.
[ ] 3. Adicionar de forma aditiva a estrutura protegida `api_keys` em `supabase_global_part3.sql`, sem alterar dados ou tabelas existentes.
[ ] 4. Criar a função Supabase protegida para salvar a chave Gemini em `api_keys` e gerar cadastro estruturado com saída validada.
[ ] 5. Criar no Assistente IA a ferramenta com descrição, prévia editável, nova geração, configuração segura da chave, salvar rascunho e cancelar.
[ ] 6. Ampliar a estrutura JSON existente do catálogo para guardar dados técnicos, origem IA, preços não informados e status de rascunho.
[ ] 7. Integrar salvamento e categoria ao repositório atual, confirmar sincronização Supabase e manter o item oculto da loja.
[ ] 8. Atualizar o editor do Catálogo para exibir e permitir edição dos campos novos e do status rascunho.
[ ] 9. Incluir a nova função no comando de publicação já configurado no projeto.
[ ] 10. Verificar tipos e testar o exemplo solicitado, documentando limites de execução ao vivo se a função ou a chave ainda não estiverem publicadas/configuradas.
[ ] 11. Registrar as tarefas concluídas no checklist acumulado.

O fluxo reutiliza `kelly_store_products_v1`, `kelly_store_categories_v1`, o repositório existente e os snapshots Supabase; não cria catálogo paralelo.

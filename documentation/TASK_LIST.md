# Plano de tarefas — Criador de Produtos com IA

[x] 1. Revisar checklist, documentação, Assistente IA, API atual, modelos do catálogo, sincronização Supabase e migrações existentes.
[x] 2. Confirmar que o catálogo reutiliza os snapshots existentes e que a nova configuração de IA não usa shop_settings nem arquivos .env.
[x] 3. Adicionar de forma aditiva a estrutura protegida api_keys em supabase_global_part3.sql, preservando tabelas e registros existentes.
[x] 4. Criar a função Supabase protegida para armazenar a chave Gemini e gerar cadastros com saída validada.
[x] 5. Criar no Assistente IA a ferramenta com descrição, prévia editável, nova geração, configuração segura da chave, salvar rascunho e cancelar.
[x] 6. Ampliar a estrutura do catálogo para guardar dados técnicos, origem IA, preços não informados e estado de rascunho.
[x] 7. Integrar categoria e salvamento ao repositório existente, sincronizar snapshots e manter o produto fora da loja.
[x] 8. Atualizar o editor do Catálogo para exibir e permitir editar os novos campos e o estado rascunho.
[x] 9. Incluir a nova função no comando de publicação já configurado no projeto.
[x] 10. Verificar os tipos e a sintaxe; confirmar no código que o exemplo da sacola não recebe dimensões ou valores financeiros inventados.
[ ] 11. Executar a validação ponta a ponta com Gemini e Supabase após aplicar a migração, publicar a função e configurar a chave no painel.
[x] 12. Registrar as entregas concluídas no checklist acumulado e na base técnica.

O fluxo reutiliza o catálogo e os snapshots Supabase existentes. A checagem estática passou; a execução real aguarda a preparação do projeto remoto descrita na tarefa 11.

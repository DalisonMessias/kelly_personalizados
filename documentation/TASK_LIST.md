# Plano de tarefas — Solicitação de Orçamento Personalizado

[x] 1. Revisar checklist, documentação, rotas, catálogo público, pedidos, permissões administrativas e estruturas Supabase existentes.
[x] 2. Confirmar que não existe tabela de orçamentos públicos e identificar o armazenamento privado de imagens e o pedido reutilizável para conversão.
[x] 3. Adicionar na parte 3 do esquema global a tabela, índices, políticas e funções seguras para criar, administrar, arquivar e converter orçamentos sem apagar dados.
[x] 4. Criar o formulário público com seleção opcional de produto, validação, referência de imagem privada, confirmação e URL amigável.
[x] 5. Criar a seção administrativa com lista, filtros, detalhes, edição de situação e valor, observações, imagem e atalho de WhatsApp.
[x] 6. Implementar conversão transacional e idempotente do orçamento aprovado em pedido existente, preservando histórico.
[x] 7. Integrar rota, menus e acesso do painel; validar tipos, sintaxe, permissões e preservação dos dados.
[x] 8. Acrescentar ao checklist e à base técnica os resultados concluídos.

A exclusão foi implementada como arquivamento lógico para preservar solicitações e históricos. A checagem de tipos passou sem diagnósticos nos módulos alterados. A validação ponta a ponta com o Supabase depende de aplicar a migração no projeto; o navegador não estava disponível nesta sessão para inspeção visual.

# Plano de tarefas — Groq como alternativa no Criador de Produtos com IA

[ ] 1. Revisar o fluxo Gemini existente, as chaves na tabela api_keys e a documentação oficial da API Groq.
[ ] 2. Adicionar ao esquema da parte 3 a configuração persistente do limite de tentativas, sem alterar ou remover dados existentes.
[ ] 3. Estender a função ai-product-builder para consultar as chaves Gemini e Groq já guardadas em api_keys e gerar com o provedor solicitado com segurança.
[ ] 4. Atualizar Configuração da IA com campo de chave Groq, estado de cada provedor e limite de tentativas configurável.
[ ] 5. Implementar tentativas alternadas, espera aleatória de 5 a 10 segundos, validação da resposta e mensagens de progresso sem limpar a descrição.
[ ] 6. Validar sintaxe e tipos dos arquivos alterados e registrar as conclusões no checklist e na base técnica.

A alternância será coordenada pela tela, enquanto cada chamada ao provedor e cada chave continuam protegidas pela função Supabase existente.

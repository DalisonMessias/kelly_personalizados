# Kelly Personalizados

Sistema web para cÃ¡lculo de custos, precificaÃ§Ã£o, catÃ¡logo de serviÃ§os, histÃ³rico, anÃ¡lise inteligente e atendimento assistido por IA para um ateliÃª de produtos personalizados.

## VisÃ£o geral

O projeto utiliza React 18, TypeScript, Vite e Tailwind CSS. Os dados pessoais e de produÃ§Ã£o sÃ£o armazenados no navegador com LocalStorage. A Groq Ã© acessada exclusivamente por uma Vercel Function, mantendo `GROQ_API_KEY` fora do frontend.

## Funcionalidades implementadas

### Dashboard
- Indicadores de custos, vendas, lucro, produtos e cÃ¡lculos.
- Produtos e orÃ§amentos recentes.
- NavegaÃ§Ã£o rÃ¡pida para calculadora e catÃ¡logo.

### Calculadora
- Nome, categoria, quantidade e descriÃ§Ã£o do serviÃ§o.
- Primeiro material exibido automaticamente.
- AdiÃ§Ã£o e remoÃ§Ã£o ilimitada de materiais.
- Materiais simples com nome e custo direto.
- Materiais proporcionais por quantidade adquirida e utilizada.
- Tinta por folha ou por serviÃ§o.
- Custo integral ou rateado da arte.
- Tempo de produÃ§Ã£o e mÃ£o de obra.
- Embalagem, energia, impressÃ£o, acabamento e despesas personalizadas.
- Percentual de desperdÃ­cio.
- PrecificaÃ§Ã£o por margem, markup ou preÃ§o manual.
- Desconto percentual opcional.
- CÃ¡lculo imediato de custo, preÃ§o, lucro e margem.
- Faixas de preÃ§o por quantidade.
- AnÃ¡lise inteligente da Groq.

### Materiais utilizados
- Todos os materiais sÃ£o somados ao custo do serviÃ§o.
- O nome e o custo podem ser alterados a qualquer momento.
- Os materiais sÃ£o incluÃ­dos ao salvar no catÃ¡logo ou no histÃ³rico.
- CÃ¡lculos reabertos recuperam materiais e demais informaÃ§Ãµes.

### AnÃ¡lise inteligente de preÃ§os
- A calculadora envia ao servidor os dados reais preenchidos.
- A anÃ¡lise retorna preÃ§o sugerido, preÃ§o mÃ­nimo, lucro, margem, avaliaÃ§Ã£o e justificativa.
- SugestÃ£o de venda por quantidade quando aplicÃ¡vel.
- Resposta JSON validada antes da exibiÃ§Ã£o.
- SugestÃµes nunca substituem o cÃ¡lculo local oficial.
- Falhas, timeout, chave ausente e limite de requisiÃ§Ãµes sÃ£o tratados sem interromper o cÃ¡lculo local.

### DuplicaÃ§Ã£o de serviÃ§os
- DisponÃ­vel no catÃ¡logo e no histÃ³rico.
- Cria uma cÃ³pia profunda dos dados relevantes.
- Abre a cÃ³pia na calculadora com indicaÃ§Ã£o visual de duplicaÃ§Ã£o.
- O original nÃ£o Ã© alterado.
- Um novo ID Ã© gerado somente ao confirmar o salvamento.
- Materiais, desconto, descriÃ§Ã£o, quantidade e configuraÃ§Ã£o podem ser editados.

### Assistente IA
- PÃ¡gina de chat chamada **Assistente IA**.
- HistÃ³rico de conversas salvo no LocalStorage.
- Novo chat, continuaÃ§Ã£o e exclusÃ£o de conversas.
- SugestÃµes de mensagens iniciais.
- Contexto limitado dos serviÃ§os, materiais e histÃ³rico relevantes.
- Busca local por nome, descriÃ§Ã£o, categoria, data, materiais, valores e palavras-chave antes da consulta Ã  Groq.
- Apenas os registros mais relevantes sÃ£o enviados Ã  IA.
- ReutilizaÃ§Ã£o inteligente de serviÃ§os anteriores preservando campos nÃ£o solicitados.
- DetecÃ§Ã£o de alteraÃ§Ãµes naturais como nome, idade, quantidade e materiais.
- ComparaÃ§Ã£o entre custos antigos e custos atuais cadastrados.
- Tratamento de ambiguidade com apresentaÃ§Ã£o das opÃ§Ãµes encontradas.
- Perguntas Ã  usuÃ¡ria quando faltarem dados.
- Proposta estruturada somente quando existirem informaÃ§Ãµes suficientes.
- BotÃ£o **Preencher calculadora** para transformar a proposta em rascunho editÃ¡vel.
- BotÃ£o **Gerar ordem de serviÃ§o**.
- VisualizaÃ§Ã£o da ordem com nÃºmero, data, produtos, materiais, custo e preÃ§o final.
- ImpressÃ£o ou salvamento em PDF pelo diÃ¡logo do navegador.
- Nenhuma proposta salva ou altera dados sem confirmaÃ§Ã£o da usuÃ¡ria.
- Antes do preenchimento, a IA apresenta um resumo das alteraÃ§Ãµes e opÃ§Ãµes de confirmar, editar ou cancelar.

### CatÃ¡logo e histÃ³rico
- Produtos por categoria.
- Busca e filtros.
- Fichas tÃ©cnicas.
- CÃ³pia, ediÃ§Ã£o e exclusÃ£o de produtos.
- HistÃ³rico de cÃ¡lculos por data e nome.
- Reabertura direta na calculadora.

### Backup
- ExportaÃ§Ã£o de produtos, histÃ³rico, configuraÃ§Ãµes, conversas e ordens em JSON.
- ImportaÃ§Ã£o e restauraÃ§Ã£o com confirmaÃ§Ã£o.
- Limpeza controlada dos dados.

### Identidade visual e responsividade
- Paleta predominante branca com rosa pink, rosa-claro, preto e cinza.
- NavegaÃ§Ã£o lateral no desktop e inferior/drawer no celular.
- Layout adaptado de 320 px atÃ© telas grandes.
- Campos com altura confortÃ¡vel e modais ajustados ao teclado mÃ³vel.
- Campos financeiros com mÃ¡scara brasileira `R$ 0,00`.
- Campos percentuais com sÃ­mbolo `%` e valores numÃ©ricos internos.
- Quantidades e tempo mantidos em inputs numÃ©ricos prÃ³prios, sem mÃ¡scara monetÃ¡ria.
- Sem textos claros sobre fundos claros.

### Assistente dedicado de criação de artes
- Página separada no menu chamada **Assistente de Artes**.
- Descrição livre e campos opcionais para nome, tema, cores, estilo, formato e dimensões.
- Geração de prompts profissionais para o Gemini.
- Copiar, melhorar, editar, gerar novamente e abrir Gemini.
- Opção A4 vertical/horizontal, fundo branco/transparente e contorno de recorte.
- Preparação de imagem para impressão A4 disponível separadamente do orçamento.
- O modal rápido de artes continua disponível dentro dos orçamentos.

### Catálogo de Produtos para futura loja
- Produtos comerciais separados dos custos internos.
- Dados públicos de nome, descrição, fotos, preço e prazo.
- Dados internos de materiais, produção, mão de obra, despesas e margem.
- Personalizações por texto, número, seleção, múltipla escolha e sim/não.
- Obrigatoriedade, valores disponíveis e acréscimos de preço por opção.
- Adicionais ativos ou inativos com preço próprio.
- Status ativo/inativo e opção de exibição futura na loja.
- Integração com a calculadora e duplicação de produtos preparados para a loja.
- Repositório único preparado para API ou banco compartilhado futuro.

### Clientes e orÃ§amentos
- Cadastro de nome, apelido, telefone, WhatsApp e observaÃ§Ãµes.
- Pesquisa por nome ou telefone.
- EdiÃ§Ã£o, exclusÃ£o e histÃ³rico de orÃ§amentos por cliente.
- Novo orÃ§amento iniciado pela **Calculadora de Custos & PrecificaÃ§Ã£o**, usando um serviÃ§o novo ou existente como modelo.
- O cliente cadastrado pode ser selecionado opcionalmente na calculadora antes de criar o orÃ§amento.
- Quantidade, valores unitÃ¡rios, subtotal, descontos em porcentagem ou reais e validade.
- VisualizaÃ§Ã£o profissional com nÃºmero, data, cliente, itens e valor total.
- Mensagem personalizada e link oficial `wa.me` com confirmaÃ§Ã£o da usuÃ¡ria.
- SituaÃ§Ãµes de orÃ§amento: Pendente, Enviado, Aprovado, Recusado e Expirado.
- DuplicaÃ§Ã£o e ediÃ§Ã£o de orÃ§amentos existentes.
- Dados persistidos no LocalStorage e incluÃ­dos no backup JSON.
- Artes em PNG, JPG, JPEG e WEBP armazenadas no IndexedDB.
- Assistente de criação de prompts para Gemini com descrição estruturada e impressão A4.
- Preenchimento automático da calculadora com dados iniciais, estimativas identificadas e confirmação manual.
- Preparador A4 com orientação, margens, linhas, colunas, contorno de recorte e fundo branco/transparente.
- Exportação da arte preparada por diálogo de impressão em PDF no formato A4.
- Miniaturas, descrição individual e ampliação das imagens.
- Tags padrão e personalizadas com cores no orçamento.
- Visualização profissional com impressão/PDF.
- Compartilhamento nativo de arquivos quando suportado pelo navegador.

## Tecnologias

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Canvas Confetti
- LocalStorage
- IndexedDB
- Groq API
- Vercel Functions

## Executar localmente

### PrÃ©-requisitos
- Node.js 18 ou superior
- Conta no Groq para obter a chave de API
- Vercel CLI opcional para testar a funÃ§Ã£o localmente

### InstalaÃ§Ã£o

```powershell
npm install
```

### VariÃ¡veis de ambiente locais

Copie `.env.example` para `.env.local`:

```env
GROQ_API_KEY=sua_chave_da_groq
GROQ_MODEL=qwen/qwen3.8-27b
```

Nunca use prefixo `VITE_` nessas variÃ¡veis e nunca coloque a chave em componentes React.

### Desenvolvimento com frontend

```powershell
npm run dev
```

A pÃ¡gina estarÃ¡ normalmente em `http://localhost:5173`.

### Desenvolvimento com Vercel Function

```powershell
npx vercel dev
```

Isso permite testar `/api/analyze-price` e as chamadas da calculadora com as variÃ¡veis de ambiente locais.

### Build

```powershell
npm run build
npm run preview
```

## Configurar na Vercel

1. FaÃ§a o push do projeto para o repositÃ³rio.
2. Importe o projeto na Vercel usando o preset Vite.
3. Em **Project Settings â†’ Environment Variables**, adicione:
   - `GROQ_API_KEY`: chave secreta da Groq.
   - `GROQ_MODEL`: opcional. Modelo padrÃ£o: `qwen/qwen3.8-27b`.
4. Aplique as variÃ¡veis aos ambientes necessÃ¡rio e faÃ§a um novo deploy.

A chave nÃ£o deve ser adicionada ao cÃ³digo, ao README, ao `.env.example` ou a variÃ¡veis `VITE_*`.

> Se uma chave foi exposta ou registrada em um arquivo versionado, revogue-a no console da Groq e gere uma nova antes do deploy.

## MÃ¡scaras financeiras

- Campos monetÃ¡rios mostram valores no padrÃ£o brasileiro `R$ 0,00`.
- Os dados internos continuam como nÃºmeros em reais, por exemplo `15.00` representa R$ 15,00.
- O ajuste visual nÃ£o altera os modelos antigos nem os arquivos de backup.
- Componentes tÃ©cnicos reutilizÃ¡veis: `src/components/ui/CurrencyInput.tsx` e `src/components/ui/PercentInput.tsx`.
- Campos percentuais mostram `%` na interface e continuam armazenando nÃºmeros entre 0 e 100.
- Quantidades, folhas, unidades e tempo nÃ£o usam mÃ¡scara monetÃ¡ria.
- Materiais, tinta, arte, mÃ£o de obra, outros custos, preÃ§o manual, descontos e faixas de quantidade utilizam os componentes controlados.

## Endpoint da Groq

O arquivo `api/analyze-price.ts` atende `/api/analyze-price`.

Modos suportados:
- `acao: "chat"`: conversa e proposta de serviÃ§o.
- Sem `acao: "chat"`: anÃ¡lise de preÃ§o da calculadora.

O servidor:
- Protege a chave da Groq.
- Usa JSON estruturado.
- Aplica timeout.
- Trata chave ausente.
- Trata limite de requisiÃ§Ãµes HTTP 429.
- Trata timeout HTTP 504.
- Trata respostas invÃ¡lidas.
- Valida nÃºmeros e formatos antes de retornar ao frontend.

## Estrutura de dados local

Os dados sÃ£o separados nas seguintes chaves do LocalStorage:

- `kelly_calc_products_v4`: catÃ¡logo de produtos.
- `kelly_calc_history_v4`: histÃ³rico de cÃ¡lculos.
- `kelly_calc_settings_v4`: configuraÃ§Ãµes do ateliÃª.
- `kelly_chat_conversations_v1`: conversas do Assistente IA.
- `kelly_service_orders_v1`: ordens de serviÃ§o geradas.
- `kelly_customers_v1`: cadastro de clientes.
- `kelly_quotes_v1`: orçamentos realizados.
- `kelly_quote_tags_v1`: etiquetas padrão e personalizadas.
- IndexedDB `kelly-personalizados-assets`: arquivos de imagens dos orçamentos.
- `kelly_store_products_v1`: produtos preparados para futura loja.
- `kelly_store_categories_v1`: categorias do catálogo futuro.
- `kelly_future_orders_v1`: pedidos estruturados para implementação futura.
- `kelly_store_change_history_v1`: histórico administrativo de alterações.

Os backups incluem essas informaÃ§Ãµes sempre que disponÃ­veis.

## SeguranÃ§a e regras financeiras

- A chave da Groq nunca chega ao navegador.
- Valores negativos sÃ£o rejeitados no assistente e no endpoint.
- Percentuais de desconto e desperdÃ­cio sÃ£o limitados a 100%.
- Quantidade deve ser pelo menos 1.
- A Groq nÃ£o salva produtos ou conversas diretamente.
- O cÃ¡lculo oficial continua exclusivamente no frontend.
- A proposta da IA nunca substitui `calculationResult` calculado pelo sistema.
- A usuÃ¡ria deve confirmar o preenchimento da calculadora e qualquer salvamento.

## Testes realizados

- Build TypeScript e Vite concluÃ­do.
- Materiais simples e proporcionais compilados.
- HistÃ³rico e catÃ¡logo preservados.
- DuplicaÃ§Ã£o disponÃ­vel sem alterar o registro original.
- CÃ¡lculos de duplicaÃ§Ã£o recalculados na calculadora.
- Respostas da Groq validadas no servidor.
- Backup JSON preservado e restaurado.
- Conversas e propostas persistidas localmente.
- Layout testado em larguras de 320, 375, 430, 768, 1366 e 1920 px.

## Como usar o Assistente IA

1. Abra **Assistente IA** no menu.
2. Use uma sugestÃ£o inicial ou descreva o serviÃ§o.
3. Informe os materiais disponÃ­veis e valores reais.
4. Informe quantidade, tempo, outros custos e desconto.
5. Quando houver dados suficientes, a IA exibirÃ¡ uma proposta.
6. Clique em **Preencher calculadora** para revisar localmente.
7. Ajuste os campos e confirme o salvamento no catÃ¡logo ou histÃ³rico.
8. Para emitir a ordem, clique em **Gerar ordem de serviÃ§o** na proposta.

As conversas continuam disponÃ­veis atÃ© serem excluÃ­das pela usuÃ¡ria.


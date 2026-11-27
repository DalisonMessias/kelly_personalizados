# Base de Conhecimento e Resoluções Técnicas (Aprendizado Contínuo)

Este documento centraliza e documenta todas as soluções técnicas, correções e boas práticas aplicadas na evolução do projeto **Kelly Personalizados**.

---

### Registro 1: Referência Indefinida de Componente de Ícone (`Sparkles`) em `CalculatorPage.tsx`

- **Contexto:** Durante a renderização da página de Calculadora de Custos (`CalculatorPage.tsx`), a seção de criação da arte utilizava a tag `<Sparkles />` para compor o título visual.
- **Causa Identificada:** O ícone `Sparkles` estava presente no JSX do componente, mas havia sido omitido na lista de desestruturação dos imports provenientes do pacote `lucide-react` no cabeçalho do arquivo.
- **Solução Aplicada:** O identificador `Sparkles` foi adicionado à lista de importações de `lucide-react` em `src/components/calculator/CalculatorPage.tsx`, restabelecendo o ciclo de montagem do componente no React.
- **Prevenção:** Sempre auditar a lista de imports de ícones ao adicionar novos blocos visuais ou refatorar seções de formulários com ícones do `lucide-react`.

---

### Registro 2: Imports de ganchos e fechamento JSX em `App.tsx`

- **Contexto:** `App.tsx` usa os ganchos `useState` e `useCallback` e retorna um fragmento JSX.
- **Causa identificada:** Os ganchos não estavam importados do React e o retorno do componente não fechava a expressão JSX e a função.
- **Solução aplicada:** Foram incluídos os imports nomeados `useState` e `useCallback`, além do fechamento `);` e da chave final do componente.
- **Prevenção:** Ao alterar componentes funcionais, conferir os ganchos usados nos imports e verificar o fechamento completo de `return`, JSX e função.

### Registro 3: Opção `baseUrl` descontinuada na configuração do TypeScript

- **Contexto:** `tsconfig.json` definia `baseUrl` apenas como base do mapeamento `@/*`.
- **Causa identificada:** O TypeScript 6.0 descontinuou `baseUrl`; o mapeamento `paths` já pode ser resolvido relativamente ao arquivo de configuração.
- **Solução aplicada:** A opção `baseUrl` foi removida e o destino do mapeamento passou a ser `./src/*`, mantendo a resolução do alias sem silenciar o aviso.
- **Prevenção:** Usar caminhos relativos explícitos em `paths` quando `baseUrl` não for necessário para resolução de módulos.

---

### Registro 4: Inicialização do cliente Supabase sem configuração pública carregada

- **Contexto:** O cliente Supabase era criado a partir de `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_ANON_KEY`.
- **Causa identificada:** A execução atual não disponibilizava essas variáveis ao código do navegador, deixando a URL vazia durante a criação do cliente.
- **Solução aplicada:** A URL HTTPS do projeto e a chave pública foram configuradas diretamente em `src/services/supabase.ts`, como determina a configuração do projeto. As entradas correspondentes foram removidas de `.env.local` e `.env.example`.
- **Prevenção:** Manter apenas a chave pública apropriada no cliente e aplicar políticas de acesso por usuário no banco e no armazenamento. Nunca colocar uma chave administrativa no código do navegador.

---

### Registro 5: Ação de saída da conta em `SettingsPage.tsx`

- **Contexto:** O botão de saída da conta estava ligado ao identificador `handleLogout`, mas o componente não definia a função.
- **Causa identificada:** A ação de encerramento da sessão não havia sido implementada no componente de configurações.
- **Solução aplicada:** Foi criada uma função assíncrona que chama `supabase.auth.signOut()` e apresenta confirmação ou falha com o componente Toast do sistema.
- **Prevenção:** Conferir se os manipuladores referenciados por botões estão definidos no escopo do componente e usam os serviços de autenticação existentes.

---

### Registro 6: Declaração de tipos para importação de arquivos CSS

- **Contexto:** `main.tsx` importa `index.css` como importação de efeito colateral.
- **Causa identificada:** O projeto não incluía as declarações de tipos do cliente do Vite na compilação do código em `src`.
- **Solução aplicada:** Foi criado `src/vite-env.d.ts` com a referência a `vite/client`, que declara os módulos de estilo reconhecidos pelo Vite.
- **Prevenção:** Manter a declaração de ambiente do Vite dentro da pasta incluída pelo `tsconfig.json`.

### Registro 7: Ação de saída disponível nos menus de navegação

- **Contexto:** A ação de saída estava disponível nas configurações, mas não nos menus de navegação.
- **Causa identificada:** Os componentes `Sidebar.tsx` e `MobileNav.tsx` não tinham um botão vinculado ao encerramento da sessão.
- **Solução aplicada:** Foi adicionado um botão de saída aos dois menus, usando `supabase.auth.signOut()` e notificações do componente Toast.
- **Prevenção:** Manter ações essenciais de conta acessíveis nos menus de navegação de computador e celular.


### Registro 8: Tratamento de falha ao validar acesso administrativo pelo cliente Supabase

- **Contexto:** A rota administrativa consulta uma função remota do Supabase para confirmar se a sessão pertence ao responsável autorizado.
- **Causa identificada:** O retorno de supabase.rpc() é tipado como PromiseLike, que não disponibiliza o método catch() na tipagem do cliente.
- **Solução aplicada:** O tratamento da rejeição foi passado como segundo argumento de then(), mantendo a rota bloqueada quando a consulta falha.
- **Prevenção:** Ao encadear chamadas do cliente Supabase tipadas como PromiseLike, usar o retorno de falha de then() ou async/await com try/catch.


### Registro 9: Persistência administrativa, proteção de contas e cópias completas

- **Contexto:** A página de parâmetros confirmava o salvamento antes de o Supabase confirmar a gravação; cada conta administrativa também isolava seus próprios snapshots. As cópias disponíveis no navegador não incluíam pedidos armazenados nas tabelas da loja nem o histórico da loja. A ação de restaurar parâmetros chamava uma rotina que também limpava outras listas.
- **Causa identificada:** O salvamento em nuvem era agendado com atraso e a interface não aguardava o resultado. A inicialização usava diretamente o identificador de cada usuário autenticado. A exportação reunia apenas dados locais, e a rotina de restauração de parâmetros reutilizava uma limpeza geral.
- **Solução aplicada:** O salvamento de parâmetros agora aguarda a confirmação do Supabase e informa falhas. Administradores ativos compartilham os snapshots da conta principal. Foram acrescentadas funções hospedadas para gestão de contas e cópias, com verificação da sessão e da permissão administrativa, resumo criptográfico, histórico persistente e restauração transacional por inserções sem substituir pedidos existentes. A remoção de acesso bloqueia a conta, registra auditoria e preserva o cadastro para atender à regra de não apagar dados. Restaurar parâmetros agora altera apenas os parâmetros.
- **Prevenção:** Manter operações administrativas e segredos exclusivamente no servidor; armazenar a autorização especial somente como resumo PBKDF2 em segredo hospedado do Supabase; aguardar confirmação do banco antes de indicar sucesso; preservar históricos e preferir operações aditivas em rotinas de restauração.


### Registro 10: Preservação de snapshots ao compartilhar dados entre administradores

- **Contexto:** A sincronização passou a usar a conta principal como origem comum para os administradores ativos.
- **Causa identificada:** Os snapshots antigos estavam separados por identificador de usuário; apenas trocar o identificador de leitura deixaria dados históricos de outras contas preservados no banco, mas invisíveis no painel.
- **Solução aplicada:** A migração reúne os snapshots mais recentes de cada conta administrativa em novas linhas para a conta principal. Para listas, mantém itens com identificadores distintos e prefere a versão da conta principal quando há repetição; para configurações, mantém a versão da conta principal quando disponível. As linhas originais permanecem intactas.
- **Prevenção:** Ao consolidar dados por conta, verificar as partições existentes antes de trocar o identificador de leitura e preferir inserções versionadas com deduplicação determinística.


### Registro 11: Mensagens de comunicação das funções hospedadas

- **Contexto:** As telas de usuários e histórico de cópias exibiam a mensagem técnica em inglês quando a chamada à função Supabase não chegava ao servidor; em modo de desenvolvimento, o carregamento inicial podia ser repetido.
- **Causa identificada:** As funções manage-admin-users e system-backup retornaram HTTP 404 no projeto conectado por ainda não estarem publicadas. O cliente também repassava diretamente a mensagem da biblioteca Supabase e as telas não protegiam a inicialização contra repetição de efeitos.
- **Solução aplicada:** Foi centralizado o tratamento das respostas, com instruções em português para função ausente, falha de comunicação ou encaminhamento. O carregamento inicial das duas telas passou a executar uma vez por montagem.
- **Prevenção:** Antes de investigar credenciais ou dados, confirmar a publicação da função no projeto Supabase selecionado; em telas React com efeitos de carregamento, impedir chamadas e notificações duplicadas durante verificações de desenvolvimento.


### Registro 12: Ação de arquivamento ausente na função de backups publicada

- **Contexto:** Ao retirar uma cópia do histórico, o sistema retornou “Ação de backup desconhecida”.
- **Causa identificada:** A interface e o código local enviam a ação de arquivamento, mas a versão publicada de `system-backup` ainda não contém essa rota.
- **Solução aplicada:** O tratamento de respostas agora identifica essa mensagem e explica que a função está desatualizada, orientando a publicação da versão atualizada e informando que os dados dos backups continuam preservados.
- **Prevenção:** Depois de adicionar uma ação à função hospedada, publicar `system-backup` antes de validar o fluxo pela interface.


### Registro 13: Associação de valores financeiros no Criador de Produtos com IA

- **Contexto:** O Criador de Produtos recebe valores monetários e percentuais por meio de uma descrição em linguagem natural.
- **Causa identificada:** Uma busca em uma janela ampla do texto poderia aceitar o mesmo valor para campos próximos, como preço de venda e custo de materiais, ou confundir margem com desconto.
- **Solução aplicada:** A validação agora associa cada valor em reais ao rótulo financeiro mais próximo antes dele e só aceita percentuais ligados ao rótulo de margem, distinguindo desconto, markup e desperdício. Também aceita o formato “40% de margem”.
- **Prevenção:** Em geração estruturada por IA, validar cada valor pelo contexto do próprio campo e deixar o campo vazio quando não houver associação explícita; a solicitação de teste da sacola não fornece preços, custos, margem ou dimensões.


### Registro 14: Campos completos e valores sugeridos no Criador de Produtos com IA

- **Contexto:** O administrador pediu que a prévia gerada não tenha campos vazios e que inclua sugestões de custo, preço e margem.
- **Causa identificada:** A primeira versão seguia a regra anterior de não estimar valores ausentes e devolvia campos vazios ou nulos quando o pedido não trazia informações comerciais ou medidas.
- **Solução aplicada:** A geração agora exige valores numéricos e textos completos, apresenta medidas e custos ausentes como sugestões da IA, usa os parâmetros reais de valor-hora, margem, markup, desperdício e tinta, calcula a mão de obra pelo valor-hora e evita sugerir preço abaixo do custo e da margem. As sugestões são sinalizadas e editáveis no Assistente e no Catálogo.
- **Prevenção:** Separar recomendações de IA de dados confirmados, persistir essa indicação com o produto e validar que todos os campos estão preenchidos antes de salvar ou publicar.


### Registro 15: Solicitações públicas de orçamento com preservação do histórico

- **Contexto:** A loja pública passou a receber pedidos de orçamento sem exigir conta do cliente, enquanto o painel administra a análise e a conversão do orçamento em pedido.
- **Risco identificado:** Permitir leitura pública direta da tabela exporia dados pessoais; armazenar imagens em URLs públicas ou apagar registros eliminaria privacidade e histórico; converter sem bloqueio poderia duplicar pedidos.
- **Solução aplicada:** A tabela fica sem acesso direto para visitantes; o envio passa por função validada, a imagem usa o bucket privado existente, as operações administrativas verificam a conta autorizada, a remoção é arquivamento lógico e a conversão bloqueia a linha e devolve o pedido existente quando chamada novamente.
- **Prevenção:** Para fluxos públicos ligados ao painel, restringir a escrita a funções validadas, manter dados pessoais fora das leituras públicas, usar armazenamento privado para arquivos e tornar conversões transacionais e idempotentes.

---

### Registro 16: Alternância resiliente de IA (Gemini e Groq) no Criador de Produtos

- **Contexto:** Durante instabilidade ou esgotamento de cota do provedor principal (Gemini), a geração de cadastros estruturados de produtos podia falhar e frustrar a criação no ateliê.
- **Causa identificada:** Havia apenas um provedor configurável e a chamada falhava de forma imediata sem contingência ou tempo de espera para recuperação de taxa.
- **Solução aplicada:** Foi integrada a API Groq com modelo compatível (`openai/gpt-oss-120b`) e esquema restrito JSON. As credenciais de ambos os provedores permanecem protegidas na tabela `api_keys` no Supabase e nunca chegam ao navegador. No frontend, foi implementada fila com tentativas alternadas (configurável de 2 a 6 tentativas), espera aleatória de 5 a 10 segundos entre falhas, mensagens transparentes de progresso sem limpar a descrição digitada pelo usuário e desempacotamento consistente do resultado na Edge Function.
- **Prevenção:** Proteger todas as chaves de provedores de IA no backend/Edge Function, validar estritamente a saída estruturada e fornecer fallback transparente com temporização para evitar bloqueios por concorrência.

---

### Registro 17: Catálogo de Modelos Groq e Padronização Completa de Controles UI (Select e Number)

- **Contexto:** O provedor Groq possuía apenas um modelo fixo (`openai/gpt-oss-120b`) e interfaces do sistema ainda utilizavam tags `<select>` nativas do navegador e campos numéricos comuns `<input type="number">`.
- **Causa identificada:** A Edge Function não aceitava outros modelos Groq e partes das telas não utilizavam componentes com estilo e acessibilidade padronizados.
- **Solução aplicada:**
  1. Criado o componente reutilizável `CustomNumberInput` em `src/components/ui/CustomNumberInput.tsx`, com botões de incremento/decremento, máscara decimal, valores mínimos/máximos e suporte a unidades (`min`, `mm`, etc.).
  2. Expandida a Edge Function `ai-product-builder` para suportar `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-120b` e `mixtral-8x7b-32768`.
  3. Adicionado seletor `CustomSelect` para o modelo de contingência Groq em `CreateAiProductPanel.tsx`, permitindo à artesã selecionar o modelo desejado.
  4. Substituição de todas as ocorrências de `<select>` nativo e inputs numéricos em modais e formulários por `CustomSelect`, `CurrencyInput`, `PercentInput` e `CustomNumberInput`.
- **Prevenção:** Utilizar sempre componentes customizados da pasta `src/components/ui/` para manter a consistência visual do ateliê e nunca permitir tags nativas com controles brutos do sistema operacional.

---

### Registro 18: Alinhamento de Formulários de IA e Tratamento da Edge Function Desatualizada

- **Contexto:** Os campos de entrada de chaves e os seletores customizados `CustomSelect` ficavam com leves desalinhamentos verticais devido à diferença entre as classes dos rótulos e gaps. Além disso, ao tentar salvar a chave do Groq com a versão publicada anterior no Supabase, a resposta era "Ação do Criador de Produtos com IA desconhecida".
- **Causa identificada:** O `CustomSelect` utilizava `gap-1.5` e caixa alta com tracking amplo no rótulo, enquanto os inputs comuns usavam `mb-1 block text-xs font-bold text-slate-700`. No backend, a versão remota da Edge Function no projeto Supabase ainda não foi republicada com a nova ação `save_groq_key`.
- **Solução aplicada:**
  1. Padronizado o estilo do rótulo do `CustomSelect` para `mb-1 block text-xs font-bold text-slate-700`, alinhando os containers por `sm:items-start`.
  2. Aprimorado o módulo `supabaseFunctionErrors.ts` para capturar a resposta de ação desconhecida e instruir com clareza o comando de publicação da função atualizada (`npm run supabase:deploy-ai-product-builder`).
- **Prevenção:** Sempre alinhar a tipografia e margens de rótulos de componentes formulário customizados com os padrões globais do formulário e fornecer mensagens contextuais transparentes para funções de nuvem que aguardam novo deploy.

---

### Registro 19: Centralização das Configurações dos Provedores de IA

- **Contexto:** O bloco de configurações de IA (chaves Gemini e Groq, modelos e limites de tentativas) ficava visível diretamente dentro da tela operacional "Criar Produto com IA", misturando parametrização técnica com a rotina de criação de produtos.
- **Causa identificada:** Necessidade de separar a responsabilidade administrativa de parametrização da tela de operação criativa.
- **Solução aplicada:**
  1. Adicionada a coluna aditiva `ai_primary_provider` na tabela `api_keys` em `supabase_global_part3.sql` para persistir a prioridade entre Gemini e Groq.
  2. Criada a seção dedicada **"Configurações dos Provedores de IA"** dentro de `SettingsPage.tsx` ("Configurações & Central de Backup"), contendo seleção de provedor principal, chaves Gemini e Groq protegidas, seleção de modelos e limite de tentativas alternadas.
  3. Removidos todos os formulários e campos de configuração de `CreateAiProductPanel.tsx`, que agora consome de forma transparente o status e a ordem de contingência configurada no ateliê.
- **Prevenção:** Manter painéis operacionais focados no fluxo de trabalho e concentrar todas as chaves e integrações na Central de Configurações do sistema.

---

### Registro 20: Eliminação de Quebra de Linha em Botões e Correção de Sintaxe no Criador de Produtos

- **Contexto:** O botão "Salvar Preferências de IA" na Central de Configurações quebrava em duas linhas ("Salvar Preferências de / IA"). Além disso, um bloco duplicado após o `handleGenerate` em `CreateAiProductPanel.tsx` causava erro de análise do Babel/Vite (`Unexpected token`).
- **Causa identificada:** A largura do container flex permitia a quebra do texto do botão por falta de `whitespace-nowrap` e `shrink-0`. No `CreateAiProductPanel.tsx`, uma edição anterior manteve uma cauda duplicada da função de geração.
- **Solução aplicada:**
  1. Removido o trecho duplicado em `CreateAiProductPanel.tsx`, normalizando a sintaxe e compilando sem erros.
  2. Texto do botão abreviado para "Salvar Preferências", aplicado `whitespace-nowrap`, `min-h-10`, padding consistente e `shrink-0` em `SettingsPage.tsx`.
  3. Aplicado `whitespace-nowrap` também nos botões de salvar chaves Gemini e Groq.
- **Prevenção:** Sempre utilizar `whitespace-nowrap` em botões de ação com textos de 2 a 3 palavras para garantir exibição em linha única em todas as resoluções.






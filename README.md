# Kelly Personalizados ✂️🎀

Um aplicativo web moderno, completo e intuitivo para controle de custos, precificação inteligente e cálculo de lucro real para ateliês de produtos e serviços personalizados (folhas de adesivos, topos de bolo 3D, lembrancinhas, caixinhas, etiquetas escolares e convites).

Desenvolvido especialmente para a **Kelly Personalizados**, operando **100% no navegador** com armazenamento local seguro (**LocalStorage**), sem necessidade de banco de dados externo, sem APIs pagas e totalmente pronto para publicação na **Vercel**.

---

## 🚀 Tecnologias Utilizadas

- **React 18** com componentes funcionais e hooks modernos.
- **TypeScript** para tipagem forte, previsibilidade e manutenibilidade.
- **Vite** para inicialização ultrarrápida e build otimizado.
- **Tailwind CSS** com paleta profissional e responsividade total (computadores, tablets e smartphones).
- **Lucide React** para ícones modernos e minimalistas.
- **Canvas Confetti** para celebração visual ao precificar e salvar produtos.
- **LocalStorage API** com persistência automática e sistema de backup/restauração em arquivos JSON.

---

## 🎯 Funcionalidades Principais

1. **Painel Geral (Dashboard)**
   - Métricas em destaque: Total de produtos cadastrados, quantidade de cálculos realizados, custos totais acumulados, valor estimado de vendas e lucro projetado.
   - Cálculo automático da margem média de lucro do ateliê.
   - Listagem dos últimos produtos e orçamentos recentes com acesso rápido.

2. **Calculadora de Custos & Precificação Completa**
   - **Materiais Proporcionais:** Calcule o custo exato utilizado com base no valor pago e quantidade do pacote (ex: 50 folhas por R$ 48,00 -> gasta 2 folhas = R$ 1,92).
   - **Tinta de Impressão:** Custo estimado por folha impressa ou valor fixo pelo trabalho.
   - **Criação da Arte:** Escolha entre cobrar o valor integral da arte ou ratear entre várias folhas do pedido.
   - **Tempo de Trabalho (Mão de Obra):** Informe o tempo em minutos ou horas e o valor/hora desejado para calcular o custo da sua mão de obra de forma justa.
   - **Outros Custos:** Embalagens, energia elétrica, desgaste de lâminas e outros gastos personalizados.
   - **Margem de Perdas / Desperdício:** Adicione uma porcentagem de segurança para folhas perdidas ou erros de corte.

3. **Estratégias Claras de Precificação & Campo Opcional de Desconto (%)**
   - **Margem de Lucro:** Percentual de lucro sobre o preço de venda (`Preço = Custo / (1 - Margem)`).
   - **Markup:** Percentual aplicado diretamente sobre o custo de produção (`Preço = Custo * (1 + Markup)`).
   - **Preço Manual:** Digite o valor que deseja cobrar e o sistema revela exatamente quanto você terá de lucro e qual a margem real.
   - **Campo Opcional de Desconto (%):**
     - Permite informar qualquer percentual válido entre 0% e 100% (se vazio, assume 0%).
     - Aplicado diretamente sobre o preço de venda calculado/sugerido (e não sobre o custo).
     - Exibe de forma transparente o valor original, o percentual concedido, o valor descontado em R$, o preço final de venda e o recálculo imediato do lucro líquido e da margem que ainda restam para a artesã.
     - Totalmente integrado à Calculadora de folhas/unidades, Catálogo de produtos, Fichas técnicas, Tabela de atacado e Histórico de orçamentos.

4. **Tabela de Descontos Progressivos por Quantidade (Atacado)**
   - Crie faixas automáticas de preços (ex: 1 folha R$ 7,50, 5 folhas R$ 30,00, 10 folhas R$ 52,00).
   - O sistema calcula o preço unitário com desconto e o **lucro real que sobrará em cada quantidade**.

5. **Catálogo de Serviços & Fichas Técnicas**
   - Salve seus produtos por categoria: Adesivos, Topos de Bolo, Lembrancinhas, Etiquetas, Convites, etc.
   - Visualize a ficha técnica detalhada de cada item com 1 clique.
   - **Duplicação rápida de produtos:** Copie um serviço existente para criar uma variação rapidamente sem redigitar todos os materiais.

6. **Histórico de Cálculos & Orçamentos**
   - Arquivamento de simulações com data, hora e anotações.
   - Filtro por data e busca por texto.
   - Reabra qualquer orçamento antigo diretamente na calculadora.

7. **Central de Backup & Segurança de Dados ("Fazer backup")**
   - Botão fixo **"Fazer backup"** no menu para download imediato de um arquivo `.JSON` seguro.
   - Importação simples para transferir todos os dados de um computador para outro ou para o celular.
   - Confirmações elegantes com modais customizados antes de qualquer exclusão ou limpeza.

---

## 💻 Como Executar Localmente

### 1. Pré-requisitos
Ter o **Node.js** (versão 18 ou superior) instalado no computador.

### 2. Instalação das Dependências
Abra o terminal na pasta do projeto e execute:
```bash
npm install
```

### 3. Rodar em Ambiente de Desenvolvimento
Execute:
```bash
npm run dev
```
O terminal exibirá o endereço local (geralmente `http://localhost:5173`). Abra esse link no seu navegador.

### 4. Testar o Build de Produção
Para verificar se a aplicação está compilando sem erros:
```bash
npm run build
npm run preview
```

---

## 🌐 Como Publicar Gratuitamente na Vercel

O projeto foi configurado com o arquivo `vercel.json` para funcionar perfeitamente como SPA (Single Page Application) estática na Vercel:

1. **Suba o projeto para o GitHub**:
   - Crie um repositório no seu GitHub e faça o push dos arquivos.
2. **Acesse a Vercel**:
   - Entre em [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
3. **Importe o Repositório**:
   - Clique em **"Add New..."** -> **"Project"**.
   - Selecione o repositório `kelly_personalizados`.
4. **Configurações de Build**:
   - A Vercel detectará automaticamente o **Vite**:
     - **Framework Preset**: `Vite`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
5. **Clique em "Deploy"**:
   - Em menos de 1 minuto seu aplicativo estará no ar com link público HTTPS (ex: `https://seu-projeto.vercel.app`) para sua sobrinha usar no computador, tablet ou celular!

---

## 🔒 Armazenamento dos Dados & Recomendações

- Como não há servidor nem banco de dados na nuvem, **todos os dados ficam salvos exclusivamente na memória do navegador do aparelho**.
- **Dica de ouro:** Oriente sua sobrinha a clicar no botão **"Fazer backup"** periodicamente (por exemplo, no final de cada semana ou após cadastrar novos produtos). O arquivo baixado pode ser guardado no Google Drive, WhatsApp ou pendrive, garantindo que ela nunca perca seus preços caso limpe o histórico do navegador.

import { MeasurementUnit } from '../types';

export interface PresetMaterial {
  id: string;
  category: 'papeis' | 'acessorios' | 'colas' | 'embalagens' | 'acabamentos';
  name: string;
  unit: MeasurementUnit;
  defaultPurchasePrice: number; // Preço real médio de mercado no Brasil
  defaultPurchaseQuantity: number; // Quantidade real no pacote de compra
  typicalUsedQuantity: number; // Quantidade típica gasta em 1 serviço
  description: string;
}

export const REAL_MATERIALS_DATABASE: PresetMaterial[] = [
  // --- Papéis Fotográficos e Especiais ---
  {
    id: 'mat-real-glossy-135g-adesivo',
    category: 'papeis',
    name: 'Papel Fotográfico Adesivo Glossy 135g A4',
    unit: 'folha',
    defaultPurchasePrice: 38.9, // Pacote de 100 folhas
    defaultPurchaseQuantity: 100,
    typicalUsedQuantity: 1,
    description: 'Ideal para folhas de adesivos, rótulos e etiquetas brilhantes à prova de respingos.',
  },
  {
    id: 'mat-real-glossy-180g',
    category: 'papeis',
    name: 'Papel Fotográfico Glossy 180g A4',
    unit: 'folha',
    defaultPurchasePrice: 42.0, // Pacote de 100 folhas
    defaultPurchaseQuantity: 100,
    typicalUsedQuantity: 1,
    description: 'Papel fotográfico de alta gramatura para apliques 3D e tags.',
  },
  {
    id: 'mat-real-glossy-230g',
    category: 'papeis',
    name: 'Papel Fotográfico Glossy 230g A4',
    unit: 'folha',
    defaultPurchasePrice: 28.5, // Pacote com 50 folhas
    defaultPurchaseQuantity: 50,
    typicalUsedQuantity: 1,
    description: 'Papel rígido fotográfico excelente para topos de bolo e bases sustentadas.',
  },
  {
    id: 'mat-real-matte-180g',
    category: 'papeis',
    name: 'Papel Fotográfico Matte Fosco 180g A4',
    unit: 'folha',
    defaultPurchasePrice: 39.9, // Pacote com 100 folhas
    defaultPurchaseQuantity: 100,
    typicalUsedQuantity: 1,
    description: 'Acabamento aveludado e sem reflexo, ótimo para fotos e convites refinados.',
  },
  {
    id: 'mat-real-offset-180g',
    category: 'papeis',
    name: 'Papel Offset Chambril 180g A4',
    unit: 'folha',
    defaultPurchasePrice: 26.0, // Pacote com 100 folhas
    defaultPurchaseQuantity: 100,
    typicalUsedQuantity: 2,
    description: 'O papel mais clássico e econômico para caixinhas de lembrancinhas (Milk, Pirâmide).',
  },
  {
    id: 'mat-real-offset-240g',
    category: 'papeis',
    name: 'Papel Offset Chambril 240g A4',
    unit: 'folha',
    defaultPurchasePrice: 19.5, // Pacote com 50 folhas
    defaultPurchaseQuantity: 50,
    typicalUsedQuantity: 1,
    description: 'Papel encorpado ideal para caixas estruturadas e convites mais pesados.',
  },
  {
    id: 'mat-real-colorplus-180g',
    category: 'papeis',
    name: 'Papel Color Plus 180g Fedrigoni A4',
    unit: 'folha',
    defaultPurchasePrice: 34.9, // Pacote com 50 folhas
    defaultPurchaseQuantity: 50,
    typicalUsedQuantity: 2,
    description: 'Papel colorido na massa (sem borda branca no corte), perfeito para topos de bolo em camadas.',
  },
  {
    id: 'mat-real-lamicote-dourado',
    category: 'papeis',
    name: 'Papel Lamicote Dourado Espelhado 250g A4',
    unit: 'folha',
    defaultPurchasePrice: 24.9, // Pacote com 10 folhas
    defaultPurchaseQuantity: 10,
    typicalUsedQuantity: 1,
    description: 'Papel metalizado espelhado de alto luxo para detalhes e nomes em topos de bolo.',
  },
  {
    id: 'mat-real-lamicote-prata',
    category: 'papeis',
    name: 'Papel Lamicote Prata Espelhado 250g A4',
    unit: 'folha',
    defaultPurchasePrice: 24.9, // Pacote com 10 folhas
    defaultPurchaseQuantity: 10,
    typicalUsedQuantity: 1,
    description: 'Metalizado espelhado prata para temas futuristas, prata e casamentos.',
  },
  {
    id: 'mat-real-kraft-200g',
    category: 'papeis',
    name: 'Papel Kraft Rústico 200g A4',
    unit: 'folha',
    defaultPurchasePrice: 21.0, // Pacote com 50 folhas
    defaultPurchaseQuantity: 50,
    typicalUsedQuantity: 1,
    description: 'Papel kraft natural para temas rústicos, fazendinha e boteco.',
  },

  // --- Acessórios e Montagem de Topos / Lembrancinhas ---
  {
    id: 'mat-real-fita-banana',
    category: 'acessorios',
    name: 'Fita Banana Dupla Face de Espuma 3D (Rolo 5m)',
    unit: 'metro',
    defaultPurchasePrice: 16.9, // Rolo com 5 metros
    defaultPurchaseQuantity: 5,
    typicalUsedQuantity: 0.25, // 25 centímetros gastos
    description: 'Dá o efeito 3D em camadas nos apliques e topos de bolo.',
  },
  {
    id: 'mat-real-canudo-acrilico',
    category: 'acessorios',
    name: 'Canudo Transparente de Acrílico para Topo de Bolo',
    unit: 'unidade',
    defaultPurchasePrice: 18.0, // Pacote com 50 canudos
    defaultPurchaseQuantity: 50,
    typicalUsedQuantity: 2, // 2 canudos por topo
    description: 'Haste transparente e higiênica que fixa o topo no bolo sem transferir gosto.',
  },
  {
    id: 'mat-real-fita-cetim-n3',
    category: 'acessorios',
    name: 'Fita de Cetim Progresso Nº 3 (15mm)',
    unit: 'metro',
    defaultPurchasePrice: 6.5, // Rolo com 10 metros
    defaultPurchaseQuantity: 10,
    typicalUsedQuantity: 0.35, // 35 cm para o laço
    description: 'Fita para laços de caixas milk, sacolinhas e lembrancinhas de luxo.',
  },
  {
    id: 'mat-real-meia-perola',
    category: 'acessorios',
    name: 'Meia Pérola Adesiva 6mm',
    unit: 'unidade',
    defaultPurchasePrice: 9.9, // Cartela com 500 pérolas
    defaultPurchaseQuantity: 500,
    typicalUsedQuantity: 6,
    description: 'Detalhe delicado para centros de laço e florzinhas de papel.',
  },
  {
    id: 'mat-real-cordao-encerado',
    category: 'acessorios',
    name: 'Cordão Encerado / Fio de Rami para Tags',
    unit: 'metro',
    defaultPurchasePrice: 14.0, // Rolo com 50 metros
    defaultPurchaseQuantity: 50,
    typicalUsedQuantity: 0.3,
    description: 'Amarração rústica para tags de agradecimento e convites.',
  },

  // --- Colas e Adesivos ---
  {
    id: 'mat-real-cola-silicone',
    category: 'colas',
    name: 'Cola de Silicone Líquida Fria 100ml',
    unit: 'ml',
    defaultPurchasePrice: 8.5, // Frasco de 100ml
    defaultPurchaseQuantity: 100,
    typicalUsedQuantity: 5, // cerca de 5ml por projeto
    description: 'Cola transparente excelente para canudos, lamicote e fitas sem manchar o papel.',
  },
  {
    id: 'mat-real-cola-pva-artesanato',
    category: 'colas',
    name: 'Cola Branca PVA Extra Artesanato 100g',
    unit: 'g',
    defaultPurchasePrice: 7.9, // Tubo de 100g
    defaultPurchaseQuantity: 100,
    typicalUsedQuantity: 6, // 6g
    description: 'Secagem rápida sem enrugar o papel offset na montagem de caixas.',
  },

  // --- Embalagens de Entrega ---
  {
    id: 'mat-real-saquinho-15x25',
    category: 'embalagens',
    name: 'Saquinho Celofane Transparente 15x25cm com Aba Adesiva',
    unit: 'unidade',
    defaultPurchasePrice: 12.5, // Pacote com 100 saquinhos
    defaultPurchaseQuantity: 100,
    typicalUsedQuantity: 1,
    description: 'Embalagem higiênica e profissional para entrega de topos e lembrancinhas.',
  },
  {
    id: 'mat-real-saquinho-a4',
    category: 'embalagens',
    name: 'Envelope Celofane 22x32cm para Folhas A4',
    unit: 'unidade',
    defaultPurchasePrice: 16.0, // Pacote com 100 unidades
    defaultPurchaseQuantity: 100,
    typicalUsedQuantity: 1,
    description: 'Protege folhas de adesivo contra umidade e poeira até o cliente usar.',
  },

  // --- Acabamentos e Desgaste de Plotter ---
  {
    id: 'mat-real-desgaste-plotter',
    category: 'acabamentos',
    name: 'Desgaste de Lâmina e Base de Corte (Plotter Silhouette/Cricut)',
    unit: 'folha',
    defaultPurchasePrice: 75.0, // Conjunto lâmina + base dura ~300 folhas
    defaultPurchaseQuantity: 300,
    typicalUsedQuantity: 1,
    description: 'Custo de depreciação do corte eletrônico para manter lâminas sempre afiadas.',
  },
  {
    id: 'mat-real-bopp-laminacao',
    category: 'acabamentos',
    name: 'Película de Laminação BOPP Brilho/Fosco A4',
    unit: 'folha',
    defaultPurchasePrice: 35.0, // Rolo fracionado para 150 folhas A4
    defaultPurchaseQuantity: 150,
    typicalUsedQuantity: 1,
    description: 'Laminação a quente que torna o adesivo impermeável e resistente a riscos.',
  },
];

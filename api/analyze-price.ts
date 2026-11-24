import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqAnalysis {
  preco_sugerido: number;
  preco_minimo: number;
  lucro_estimado: number;
  margem_lucro: number;
  avaliacao: string;
  justificativa: string;
  sugestao_quantidade: string;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseGroqJson(content: string): GroqAnalysis | null {
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned);
    const suggested = finiteNumber(parsed.preco_sugerido);
    const minimum = finiteNumber(parsed.preco_minimo);
    const profit = finiteNumber(parsed.lucro_estimado);
    const margin = finiteNumber(parsed.margem_lucro);

    if (suggested === null || minimum === null || profit === null || margin === null || suggested < 0 || minimum < 0 || margin < 0 || margin > 100 || typeof parsed.avaliacao !== 'string' || typeof parsed.justificativa !== 'string' || typeof parsed.sugestao_quantidade !== 'string') return null;

    return {
      preco_sugerido: suggested,
      preco_minimo: minimum,
      lucro_estimado: profit,
      margem_lucro: margin,
      avaliacao: parsed.avaliacao,
      justificativa: parsed.justificativa,
      sugestao_quantidade: parsed.sugestao_quantidade,
    };
  } catch {
    return null;
  }
}

interface ChatProposal {
  nome: string;
  descricao: string;
  materiais: Array<{ nome: string; quantidade: number; unidade: string; custo_individual: number }>;
  custo_total_materiais: number;
  custo_tinta: number;
  custo_arte: number;
  tempo_producao: number;
  unidade_tempo: 'minutes' | 'hours';
  custo_mao_de_obra: number;
  outros_custos: number;
  desperdicio_percentual: number;
  quantidade_produzida: number;
  desconto_percentual: number;
  preco_sugerido: number;
  observacoes: string;
}

function parseChatJson(content: string): { resposta: string; proposta: ChatProposal | null } | null {
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.resposta !== 'string') return null;

    if (parsed.proposta == null) return { resposta: parsed.resposta, proposta: null };

    const proposal = parsed.proposta;
    const requiredStrings = ['nome', 'descricao', 'observacoes'];
    if (requiredStrings.some((key) => typeof proposal[key] !== 'string')) return null;

    if (!Array.isArray(proposal.materiais)) return null;
    const materials = proposal.materiais.map((material: any) => {
      if (!material || typeof material.nome !== 'string' || typeof material.unidade !== 'string') return null;
      const quantity = finiteNumber(material.quantidade);
      const cost = finiteNumber(material.custo_individual);
      if (quantity === null || cost === null || quantity < 0 || cost < 0) return null;
      return { nome: material.nome, quantidade: quantity, unidade: material.unidade, custo_individual: cost };
    });
    if (materials.some((material: ChatProposal['materiais'][number] | null) => material === null)) return null;

    const numericKeys = ['custo_total_materiais', 'custo_tinta', 'custo_arte', 'tempo_producao', 'custo_mao_de_obra', 'outros_custos', 'desperdicio_percentual', 'quantidade_produzida', 'desconto_percentual', 'preco_sugerido'];
    if (numericKeys.some((key) => finiteNumber(proposal[key]) === null)) return null;
    if (!['minutes', 'hours'].includes(proposal.unidade_tempo)) return null;

    const numericProposal = Object.fromEntries(numericKeys.map((key) => [key, Number(proposal[key])])) as Record<string, number>;
    if (Object.values(numericProposal).some((value) => value < 0) || numericProposal.quantidade_produzida < 1 || numericProposal.desconto_percentual > 100 || numericProposal.desperdicio_percentual > 100) return null;

    return {
      resposta: parsed.resposta,
      proposta: {
        nome: proposal.nome,
        descricao: proposal.descricao,
        materiais: materials as ChatProposal['materiais'],
        custo_total_materiais: numericProposal.custo_total_materiais,
        custo_tinta: numericProposal.custo_tinta,
        custo_arte: numericProposal.custo_arte,
        tempo_producao: numericProposal.tempo_producao,
        unidade_tempo: proposal.unidade_tempo,
        custo_mao_de_obra: numericProposal.custo_mao_de_obra,
        outros_custos: numericProposal.outros_custos,
        desperdicio_percentual: numericProposal.desperdicio_percentual,
        quantidade_produzida: numericProposal.quantidade_produzida,
        desconto_percentual: numericProposal.desconto_percentual,
        preco_sugerido: numericProposal.preco_sugerido,
        observacoes: proposal.observacoes,
      },
    };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'MÃ©todo nÃ£o permitido.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'A integraÃ§Ã£o inteligente nÃ£o estÃ¡ configurada. Configure GROQ_API_KEY no ambiente.' });
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Dados do cÃ¡lculo invÃ¡lidos.' });
  }

  if (payload.acao === 'art_prompt') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);
    const artPrompt = `Você cria prompts profissionais para o Gemini gerar artes personalizadas em português.
Use somente dados fornecidos pelo administrador. Não invente nomes, idades, frases ou informações.
Quando o administrador mencionar personagens, celebridades, marcas ou identidades protegidas por direitos autorais ou comerciais, não mantenha nomes oficiais, rostos, logotipos ou estilos copiados. Substitua por personagens genéricos com tema equivalente, cores e clima semelhantes, descritos de forma original e neutra.
Exemplo: Homem de Ferro pode virar "herói robótico futurista original"; Capitão América pode virar "herói simbólico com escudo abstrato original"; personagens da Disney ou da Marvel podem virar "personagens de fantasia de inspiração geral", sem nomes oficiais.
Informe no campo alerta que referências protegidas foram convertidas em alternativas genéricas permitidas.
Organize composição, tema, cores, estilo, proporção, texto e elementos visuais.
Se payload.preparar_a4=true, o prompt deve obrigatoriamente exigir uma folha A4 vertical ou horizontal adequada, 210x297mm, resolução 300 DPI quando possível, fundo branco ou transparente, margens seguras, contornos de recorte discretos e vários elementos distribuídos sem sobreposição.
Retorne exclusivamente JSON válido: {"prompt":"","melhorias":[],"formato":"","alerta":""}.`;

    try {
      const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`,
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: artPrompt },
            { role: 'user', content: JSON.stringify(payload.descricao || payload) },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status === 429 ? 429 : 502).json({ error: response.status === 429 ? 'Limite de requisições da Groq atingido.' : 'Não foi possível gerar o prompt da arte.' });
      }

      const groqData = await response.json();
      const content = groqData?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') return res.status(502).json({ error: 'Resposta inválida da IA.' });

      try {
        const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''));
        if (typeof parsed.prompt !== 'string' || !parsed.prompt.trim()) {
          return res.status(502).json({ error: 'A IA não retornou um prompt válido.' });
        }
        return res.status(200).json({ artPrompt: parsed });
      } catch {
        return res.status(502).json({ error: 'A resposta do prompt não possui JSON válido.' });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      return res.status(error instanceof Error && error.name === 'AbortError' ? 504 : 502).json({ error: 'Falha ao gerar o prompt da arte.' });
    }
  }

  if (payload.acao === 'calculator_fill') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);
    const fillPrompt = `Você auxilia uma artesã a estimar campos da calculadora de custos no Brasil.
Use somente dados fornecidos ou estimativas claramente identificadas.
Não consulte nem presuma preços de internet. Considere produtos personalizados como pequenas encomendas, use valores modestos e realistas quando a artesã não informou dados.
Nunca use nomes de materiais como "x", "xx", strings vazias ou valores fictícios. Materiais sem nome real devem ser omitidos.
Para topo de bolo e papelaria personalizada, use custos unitários baixos e quantidade igual a 1, salvo indicação clara de quantidade.
Preços de venda sugeridos devem cobrir os custos estimados, mas não podem ser dez vezes ou muito acima do custo apenas por margem; use como referência uma margem prática entre 30% e 50%.
Retorne somente JSON: {"descricao":"","materiais":[{"nome":"","quantidade":1,"custo":0}],"custo_tinta":0,"custo_arte":0,"tempo_producao":0,"unidade_tempo":"minutes","custo_mao_de_obra":0,"embalagem":0,"energia":0,"outros_custos":0,"desperdicio_percentual":0,"quantidade_unidades":1,"preco_sugerido":0,"lucro_estimado":0,"margem_lucro":0,"estimativas":[""],"observacoes":""}.`;

    try {
      const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: fillPrompt },
            { role: 'user', content: JSON.stringify({ nome_produto: payload.nome_produto || payload.produto?.nome || '' }) },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status === 429 ? 429 : 502).json({ error: response.status === 429 ? 'Limite de requisições da Groq atingido.' : 'Não foi possível preencher a calculadora.' });
      }

      const groqData = await response.json();
      const content = groqData?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') return res.status(502).json({ error: 'Resposta inválida da IA.' });

      try {
        const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''));
        return res.status(200).json({ calculatorFill: parsed });
      } catch {
        return res.status(502).json({ error: 'A resposta de preenchimento não possui JSON válido.' });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      return res.status(error instanceof Error && error.name === 'AbortError' ? 504 : 502).json({ error: 'Falha ao gerar estimativas da calculadora.' });
    }
  }

  if (payload.acao === 'chat') {
    const chatPrompt = `VocÃª Ã© assistente de um ateliÃª brasileiro de produtos personalizados.
Converse de forma educada, simples e objetiva. Use somente materiais e valores presentes no contexto local.
NÃ£o invente custos. Quando faltar uma informaÃ§Ã£o, faÃ§a uma pergunta clara.
Ao receber resultados_relevantes, use apenas esses registros como referÃªncia. Preserve todos os campos nÃ£o mencionados pela usuÃ¡ria.
Se houver mais de um registro plausÃ­vel, liste as opÃ§Ãµes em resposta e pergunte qual serÃ¡ usado. Nunca escolha silenciosamente em caso de ambiguidade.
Para pedidos que alteram nome, idade, quantidade ou materiais, aplique somente as alteraÃ§Ãµes pedidas e mantenha os dados originais intactos.
Retorne preÃ§os recalculados a partir dos custos atuais da referÃªncia; nÃ£o reaproveite o preÃ§o antigo como preÃ§o definitivo.
Retorne exclusivamente JSON vÃ¡lido sem markdown.
Formato: {"resposta":"texto","proposta":null ou {"nome":"","descricao":"","materiais":[{"nome":"","quantidade":0,"unidade":"unidade","custo_individual":0}],"custo_total_materiais":0,"custo_tinta":0,"custo_arte":0,"tempo_producao":0,"unidade_tempo":"minutes","custo_mao_de_obra":0,"outros_custos":0,"desperdicio_percentual":0,"quantidade_produzida":1,"desconto_percentual":0,"preco_sugerido":0,"observacoes":""}}.
SÃ³ inclua proposta quando existirem dados suficientes. Todos os nÃºmeros devem ser nÃ£o negativos e custos devem respeitar o contexto informado.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);

    try {
      const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
      const groqResponse = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: chatPrompt },
            { role: 'system', content: `Contexto relevante do sistema: ${JSON.stringify(payload.contexto || {})}` },
            ...(Array.isArray(payload.conversa) ? payload.conversa.slice(-12).map((message: any) => ({
              role: message.role === 'assistant' ? 'assistant' : 'user',
              content: String(message.content || ''),
            })) : []),
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (groqResponse.status === 429) {
        return res.status(429).json({ error: 'Limite de requisiÃ§Ãµes da Groq atingido. Aguarde alguns instantes.' });
      }
      if (!groqResponse.ok) {
        const detail = await groqResponse.text().catch(() => '');
        console.error('Groq chat API error', groqResponse.status, detail);
        return res.status(502).json({ error: 'O assistente nÃ£o pÃ´de processar a conversa agora.' });
      }

      const groqData = await groqResponse.json();
      const content = groqData?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        return res.status(502).json({ error: 'O assistente retornou uma resposta invÃ¡lida.' });
      }

      const chatResult = parseChatJson(content);
      if (!chatResult) {
        return res.status(502).json({ error: 'A resposta do assistente nÃ£o possui o formato esperado.' });
      }

      return res.status(200).json(chatResult);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return res.status(504).json({ error: 'Tempo de espera do assistente excedido.' });
      }
      console.error('Groq chat connection error', error);
      return res.status(502).json({ error: 'Falha de conexÃ£o com o assistente inteligente.' });
    }
  }

  const systemPrompt = `VocÃª Ã© especialista brasileiro em precificaÃ§Ã£o de produtos personalizados.
Analise somente os dados enviados pelo sistema. Nunca invente custos, nunca altere o custo total e nunca use valores fora dos dados informados.
Retorne exclusivamente um objeto JSON vÃ¡lido, sem markdown e sem texto fora do JSON.
Considere custo total, quantidade, desperdÃ­cio, desconto aplicado e lucro restante.
O preco_minimo deve cobrir pelo menos o custo total de produÃ§Ã£o.
Calcule lucro_estimado = preco_sugerido - custo_total_producao.
Calcule margem_lucro = (lucro_estimado / preco_sugerido) * 100.
Use avaliacao, justificativa e sugestao_quantidade em portuguÃªs simples.
Se a quantidade for maior que 1, sugira uma estratÃ©gia coerente para venda em quantidade.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 22000);

  try {
    const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
    const groqResponse = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (groqResponse.status === 429) {
      return res.status(429).json({ error: 'Limite de requisiÃ§Ãµes da Groq atingido. Aguarde alguns instantes.' });
    }
    if (!groqResponse.ok) {
      const detail = await groqResponse.text().catch(() => '');
      console.error('Groq API error', groqResponse.status, detail);
      return res.status(502).json({ error: 'A Groq nÃ£o pÃ´de processar a anÃ¡lise agora.' });
    }

    const groqData = await groqResponse.json();
    const content = groqData?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return res.status(502).json({ error: 'A Groq retornou uma resposta invÃ¡lida.' });
    }

    const analysis = parseGroqJson(content);
    if (!analysis) {
      return res.status(502).json({ error: 'A resposta da IA nÃ£o possui o formato esperado.' });
    }

    const cost = finiteNumber(payload.custo_total_producao);
    if (cost !== null) {
      analysis.preco_minimo = Math.max(cost, analysis.preco_minimo);
      analysis.preco_sugerido = Math.max(cost, analysis.preco_sugerido);
      analysis.lucro_estimado = Number((analysis.preco_sugerido - cost).toFixed(2));
      analysis.margem_lucro = analysis.preco_sugerido > 0
        ? Number(((analysis.lucro_estimado / analysis.preco_sugerido) * 100).toFixed(2))
        : 0;
    }

    return res.status(200).json({ analysis });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({ error: 'Tempo de espera da anÃ¡lise excedido.' });
    }
    console.error('Groq connection error', error);
    return res.status(502).json({ error: 'Falha de conexÃ£o com o serviÃ§o de inteligÃªncia artificial.' });
  }
}
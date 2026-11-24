import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function getGroqConfig() {
  const envPath = path.resolve(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return { apiKey: '', model: 'qwen/qwen3.8-27b' };

  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }

  return {
    apiKey: values.GROQ_API_KEY || '',
    model: values.GROQ_MODEL || 'qwen/qwen3.8-27b',
  };
}

function groqLocalPlugin() {
  return {
    name: 'groq-local-api',
    configureServer(server: any) {
      server.middlewares.use('/api/analyze-price', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'MÃ©todo nÃ£o permitido.' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });

        req.on('end', async () => {
          const { apiKey, model } = getGroqConfig();
          if (!apiKey) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Configure GROQ_API_KEY em .env.local.' }));
            return;
          }

          let payload: any;
          try {
            payload = body ? JSON.parse(body) : {};
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Dados invÃ¡lidos.' }));
            return;
          }

          const isChat = payload.acao === 'chat';
          const isArtPrompt = payload.acao === 'art_prompt';
          const isCalculatorFill = payload.acao === 'calculator_fill';
          const systemPrompt = isArtPrompt
            ? 'Você cria prompts profissionais em português para gerar artes personalizadas. Use somente dados fornecidos pelo administrador, não invente informações e substitua personagens, marcas ou identidades protegidas por personagens genéricos originais com tema equivalente. Não mencione nomes oficiais, rostos, logotipos ou estilos copiados e informe a substituição no alerta. Retorne JSON com prompt, melhorias, formato e alerta.'
            : isCalculatorFill
              ? 'Você auxilia estimativas da calculadora de custos no Brasil. Use custos unitários modestos e realistas, não consulte valores de internet nem invente preços altos. Para topo de bolo use quantidade 1 quando não houver quantidade informada. Sugira uma margem prática entre 30% e 50%, marque estimativas e retorne JSON com descricao, materiais, custos, tempo, quantidade, preco_sugerido, lucro_estimado, margem_lucro, estimativas e observacoes.'
              : isChat
            ? 'VocÃª Ã© assistente de precificaÃ§Ã£o de produtos personalizados. Use somente os dados do contexto local, nÃ£o invente custos e responda exclusivamente JSON vÃ¡lido com resposta e proposta.'
            : 'VocÃª Ã© especialista em precificaÃ§Ã£o de produtos personalizados. Analise somente os dados informados e retorne exclusivamente JSON vÃ¡lido com preco_sugerido, preco_minimo, lucro_estimado, margem_lucro, avaliacao, justificativa e sugestao_quantidade.';

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 22000);

          try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
                  { role: 'system', content: `Contexto: ${JSON.stringify(payload.contexto || payload.descricao || payload)}` },
                  ...(isChat && Array.isArray(payload.conversa)
                    ? payload.conversa.slice(-12).map((message: any) => ({
                        role: message.role === 'assistant' ? 'assistant' : 'user',
                        content: String(message.content || ''),
                      }))
                    : [{ role: 'user', content: JSON.stringify(payload) }]),
                ],
              }),
              signal: controller.signal,
            });

            clearTimeout(timeout);
            const data: any = await response.json().catch(() => null);

            if (!response.ok) {
              res.statusCode = response.status === 429 ? 429 : 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: response.status === 429
                  ? 'Limite de requisiÃ§Ãµes da Groq atingido.'
                  : 'A Groq nÃ£o pÃ´de processar a solicitaÃ§Ã£o.',
              }));
              return;
            }

            const content = data?.choices?.[0]?.message?.content;
            if (typeof content !== 'string') {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'A Groq retornou uma resposta invÃ¡lida.' }));
              return;
            }

            try {
              const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''));
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(
                isChat ? parsed
                  : isArtPrompt ? { artPrompt: parsed }
                    : isCalculatorFill ? { calculatorFill: parsed }
                      : { analysis: parsed }
              ));
            } catch {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'A resposta da IA nÃ£o possui JSON vÃ¡lido.' }));
            }
          } catch (error: any) {
            clearTimeout(timeout);
            res.statusCode = error?.name === 'AbortError' ? 504 : 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: error?.name === 'AbortError'
                ? 'Tempo de espera da anÃ¡lise excedido.'
                : 'Falha de conexÃ£o com a Groq.',
            }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), groqLocalPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
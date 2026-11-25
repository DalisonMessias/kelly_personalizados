interface FunctionFailure {
  name?: string;
  message?: string;
  context?: unknown;
}

interface FunctionResponseBody {
  code?: string;
  message?: string;
  error?: string;
}

export async function getSupabaseFunctionErrorMessage(error: unknown, functionName: string): Promise<string> {
  const failure = error && typeof error === 'object' ? error as FunctionFailure : {};
  const response = failure.context instanceof Response ? failure.context : null;
  let body: FunctionResponseBody | null = null;

  if (response) {
    try {
      body = await response.clone().json() as FunctionResponseBody;
    } catch {
      body = null;
    }
  }

  const notPublished = response?.status === 404 || body?.code === 'NOT_FOUND' ||
    /requested function was not found|function not found/i.test(body?.message ?? '');
  if (notPublished) {
    return `A função “${functionName}” não está publicada neste projeto Supabase. Publique-a e tente novamente.`;
  }

  if (functionName === 'system-backup' && /ação de backup desconhecida/i.test(body?.error ?? body?.message ?? '')) {
    return 'A função “system-backup” publicada está desatualizada e ainda não reconhece esta ação. Publique a versão atualizada da função no Supabase e tente novamente. Os dados dos backups continuam preservados.';
  }

  if (failure.name === 'FunctionsFetchError' || /failed to send a request to the edge function/i.test(failure.message ?? '')) {
    return `Não foi possível alcançar a função “${functionName}”. Verifique a conexão e se ela está publicada no Supabase.`;
  }

  if (failure.name === 'FunctionsRelayError') {
    return `O Supabase não conseguiu encaminhar a solicitação para “${functionName}”. Tente novamente em instantes.`;
  }

  if (body?.error) return body.error;
  if (body?.message && response?.status !== 404) return body.message;
  return `Não foi possível concluir a solicitação à função “${functionName}”. Tente novamente em instantes.`;
}

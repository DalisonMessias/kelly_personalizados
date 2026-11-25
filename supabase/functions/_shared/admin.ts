import { createClient, SupabaseClient, User } from 'npm:@supabase/supabase-js@2';

export class FunctionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function readKeyMap(name: string): Record<string, string> {
  const value = Deno.env.get(name);
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return {};
  }
}

function requiredProjectUrl(): string {
  const value = Deno.env.get('SUPABASE_URL');
  if (!value) throw new FunctionError(503, 'A configuração do serviço está incompleta.');
  return value;
}

export function requiredServiceClient(): SupabaseClient {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    readKeyMap('SUPABASE_SECRET_KEYS').default;
  if (!key) throw new FunctionError(503, 'A chave administrativa do serviço não está configurada.');
  return createClient(requiredProjectUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function requireAdministrator(request: Request): Promise<{
  actor: User;
  admin: SupabaseClient;
}> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new FunctionError(401, 'Entre em uma conta administrativa para continuar.');
  }

  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ??
    readKeyMap('SUPABASE_PUBLISHABLE_KEYS').default;
  if (!publishableKey) throw new FunctionError(503, 'A configuração do serviço está incompleta.');

  const userClient = createClient(requiredProjectUrl(), publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new FunctionError(401, 'A sessão expirou. Entre novamente.');

  const { data: allowed, error: permissionError } = await userClient.rpc('kelly_is_storefront_admin_v1');
  if (permissionError || allowed !== true) {
    throw new FunctionError(403, 'Esta conta não tem permissão para administrar o sistema.');
  }

  return { actor: userData.user, admin: requiredServiceClient() };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function corsHeaders(request: Request): HeadersInit {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

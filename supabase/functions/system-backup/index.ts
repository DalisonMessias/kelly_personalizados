import { corsHeaders, FunctionError, jsonResponse, requireAdministrator } from '../_shared/admin.ts';

const SNAPSHOT_TABLE = 'kelly_user_data_snapshots_v1';
const BACKUP_TABLE = 'kelly_admin_backup_history_v1';
const DATA_KEYS = [
  'kelly_calc_products_v4',
  'kelly_calc_history_v4',
  'kelly_calc_settings_v4',
  'kelly_chat_conversations_v1',
  'kelly_service_orders_v1',
  'kelly_customers_v1',
  'kelly_quotes_v1',
  'kelly_quote_tags_v1',
  'kelly_store_products_v1',
  'kelly_store_categories_v1',
  'kelly_future_orders_v1',
  'kelly_store_change_history_v1',
] as const;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function response(request: Request, body: unknown, status = 200): Response {
  const result = jsonResponse(body, status);
  const headers = new Headers(result.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(result.body, { status: result.status, headers });
}

function stableStringify(value: JsonValue): string {
  if (Array.isArray(value)) return '[' + value.map((item) => stableStringify(item)).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

async function digest(value: JsonValue): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function withoutChecksum(value: Record<string, unknown>): Record<string, unknown> {
  const { checksum: _checksum, ...payload } = value;
  return payload;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function listSanitizedUsers(admin: Awaited<ReturnType<typeof requireAdministrator>>['admin']) {
  const allUsers: Record<string, unknown>[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new FunctionError(502, 'Não foi possível incluir os usuários no backup.');
    const batch = data.users as unknown as Record<string, unknown>[];
    allUsers.push(...batch);
    if (batch.length < 1000) break;
  }

  const { data: roles, error } = await admin.from('kelly_storefront_admins_v1')
    .select('user_id,is_primary,is_admin,is_active');
  if (error) throw new FunctionError(502, 'Não foi possível incluir as permissões no backup.');
  const roleById = new Map((roles ?? []).map((role) => [role.user_id as string, role]));

  return allUsers.map((user) => {
    const metadata = isObject(user.user_metadata) ? user.user_metadata : {};
    const role = roleById.get(String(user.id));
    return {
      id: String(user.id ?? ''),
      email: typeof user.email === 'string' ? user.email : '',
      name: typeof metadata.name === 'string' ? metadata.name : '',
      username: typeof metadata.username === 'string' ? metadata.username : '',
      createdAt: typeof user.created_at === 'string' ? user.created_at : null,
      lastSignInAt: typeof user.last_sign_in_at === 'string' ? user.last_sign_in_at : null,
      isAdmin: role ? role.is_primary === true || role.is_admin === true : false,
      isActive: role?.is_active !== false && (!user.banned_until || new Date(String(user.banned_until)).getTime() <= Date.now()),
    };
  });
}

async function createBackup(admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'], actorId: string) {
  const { data: ownerId, error: ownerError } = await admin.rpc('kelly_storefront_owner_v1');
  if (ownerError || typeof ownerId !== 'string') throw new FunctionError(503, 'Não foi possível localizar a conta principal dos dados.');

  const snapshotResults = await Promise.all(DATA_KEYS.map(async (dataKey) => {
    const { data, error } = await admin.from(SNAPSHOT_TABLE)
      .select('data_value,created_at')
      .eq('user_id', ownerId)
      .eq('data_key', dataKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { dataKey, data, error };
  }));
  if (snapshotResults.some((result) => result.error)) throw new FunctionError(502, 'Não foi possível ler todos os dados do backup.');
  const appData: Record<string, unknown> = {};
  for (const { dataKey, data } of snapshotResults) appData[dataKey] = data?.data_value ?? (dataKey === 'kelly_calc_settings_v4' ? {} : []);

  const [ordersResult, historyResult, users] = await Promise.all([
    admin.from('kelly_storefront_orders_v1').select('*').order('created_at', { ascending: true }),
    admin.from('kelly_storefront_order_history_v1').select('*').order('created_at', { ascending: true }),
    listSanitizedUsers(admin),
  ]);
  if (ordersResult.error || historyResult.error) throw new FunctionError(502, 'Não foi possível ler os pedidos da loja para o backup.');

  const backupId = crypto.randomUUID();
  const payload: Record<string, unknown> = {
    version: '2.0.0',
    backupId,
    exportedAt: new Date().toISOString(),
    appData,
    storefrontOrders: ordersResult.data ?? [],
    storefrontOrderHistory: historyResult.data ?? [],
    users,
    restorationNotes: ['Senhas, tokens e credenciais não são exportados.', 'A lista de usuários é apenas informativa e não cria contas durante a restauração.'],
  };
  const backup = { ...payload, checksum: await digest(payload as JsonValue) };
  const { error: insertError } = await admin.from(BACKUP_TABLE).insert({
    id: backupId,
    created_by: actorId,
    backup_data: backup,
    integrity_sha256: backup.checksum,
  });
  if (insertError) throw new FunctionError(502, 'O arquivo foi preparado, mas não foi possível gravar o histórico de backup.');
  return backup;
}

function validateBackup(value: unknown): asserts value is Record<string, unknown> {
  if (!isObject(value) || value.version !== '2.0.0' || typeof value.exportedAt !== 'string' || typeof value.checksum !== 'string') {
    throw new FunctionError(400, 'O arquivo não é uma cópia de segurança compatível.');
  }
  if (!isObject(value.appData) || !Array.isArray(value.storefrontOrders) || !Array.isArray(value.storefrontOrderHistory) || !Array.isArray(value.users)) {
    throw new FunctionError(400, 'A estrutura da cópia está incompleta.');
  }
  for (const key of DATA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value.appData, key)) {
      throw new FunctionError(400, 'A cópia não contém todos os dados necessários.');
    }
    const item = value.appData[key];
    if (key === 'kelly_calc_settings_v4') {
      if (!isObject(item)) throw new FunctionError(400, 'As configurações da cópia estão inválidas.');
    } else if (!Array.isArray(item)) {
      throw new FunctionError(400, 'Uma das listas de dados da cópia está inválida.');
    }
  }
}

async function validateChecksum(value: Record<string, unknown>): Promise<void> {
  const expected = await digest(withoutChecksum(value) as JsonValue);
  if (expected !== value.checksum) throw new FunctionError(400, 'A verificação de integridade da cópia não foi aprovada.');
}

async function restoreBackup(admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'], actorId: string, value: unknown) {
  validateBackup(value);
  await validateChecksum(value);
  const { data: ownerId, error: ownerError } = await admin.rpc('kelly_storefront_owner_v1');
  if (ownerError || typeof ownerId !== 'string') throw new FunctionError(503, 'Não foi possível localizar a conta principal dos dados.');
  const { error: restoreError } = await admin.rpc('kelly_restore_system_backup_v1', {
    p_owner_user_id: ownerId,
    p_actor_user_id: actorId,
    p_app_data: value.appData,
    p_storefront_orders: value.storefrontOrders,
    p_storefront_order_history: value.storefrontOrderHistory,
    p_backup_data: value,
    p_integrity_sha256: value.checksum,
  });
  if (restoreError) throw new FunctionError(502, 'Não foi possível concluir a restauração. Nenhuma parte da operação foi gravada.');

  return {
    appData: value.appData,
    message: 'Dados e pedidos restaurados. Contas e credenciais foram mantidas; a lista de usuários da cópia é apenas informativa.',
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response(request, { ok: true });
  if (request.method !== 'POST') return response(request, { error: 'Método não permitido.' }, 405);

  try {
    const { actor, admin } = await requireAdministrator(request);
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      throw new FunctionError(400, 'O pedido enviado é inválido.');
    }

    if (body.action === 'create') return response(request, { backup: await createBackup(admin, actor.id) }, 201);
    if (body.action === 'list') {
      const { data, error } = await admin.from(BACKUP_TABLE)
        .select('id,created_at,integrity_sha256')
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new FunctionError(502, 'Não foi possível carregar o histórico de cópias.');
      return response(request, { backups: (data ?? []).map((item) => ({ id: item.id, createdAt: item.created_at, checksum: item.integrity_sha256 })) });
    }
    if (body.action === 'get') {
      const backupId = typeof body.backupId === 'string' ? body.backupId : '';
      const { data, error } = await admin.from(BACKUP_TABLE).select('backup_data')
        .eq('id', backupId)
        .is('archived_at', null)
        .maybeSingle();
      if (error || !data) throw new FunctionError(404, 'Cópia de segurança não encontrada.');
      validateBackup(data.backup_data);
      await validateChecksum(data.backup_data);
      return response(request, { backup: data.backup_data });
    }
    if (body.action === 'archive') {
      const backupId = typeof body.backupId === 'string' ? body.backupId : '';
      if (!backupId) throw new FunctionError(400, 'Informe a cópia que deseja retirar do histórico.');
      const { data, error } = await admin.from(BACKUP_TABLE)
        .update({ archived_at: new Date().toISOString() })
        .eq('id', backupId)
        .is('archived_at', null)
        .select('id')
        .maybeSingle();
      if (error) throw new FunctionError(502, 'Não foi possível retirar a cópia do histórico.');
      if (!data) throw new FunctionError(404, 'Cópia de segurança não encontrada no histórico.');
      return response(request, { message: 'Cópia retirada do histórico. O conteúdo foi preservado no banco de dados.' });
    }
    if (body.action === 'restore') {
      return response(request, await restoreBackup(admin, actor.id, body.backup));
    }
    throw new FunctionError(400, 'Ação de backup desconhecida.');
  } catch (error) {
    const status = error instanceof FunctionError ? error.status : 500;
    const message = error instanceof FunctionError ? error.message : 'Não foi possível concluir a operação de backup. Tente novamente.';
    return response(request, { error: message }, status);
  }
});

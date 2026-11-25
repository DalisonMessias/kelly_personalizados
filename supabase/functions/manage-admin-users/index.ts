import { corsHeaders, FunctionError, jsonResponse, requireAdministrator } from '../_shared/admin.ts';

const ADMIN_TABLE = 'kelly_storefront_admins_v1';
const AUTH_BAN_DURATION = '876000h';

function response(request: Request, body: unknown, status = 200): Response {
  const result = jsonResponse(body, status);
  const headers = new Headers(result.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(result.body, { status: result.status, headers });
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function matchesAuthorizationPassword(password: string): Promise<boolean> {
  const configuredHash = Deno.env.get('USER_DELETE_AUTHORIZATION_HASH');
  if (!configuredHash) throw new FunctionError(503, 'A autorização especial ainda não está configurada no servidor.');

  const [algorithm, roundsText, saltText, expectedText] = configuredHash.split('$');
  const rounds = Number(roundsText);
  if (algorithm !== 'pbkdf2-sha256' || !Number.isInteger(rounds) || rounds < 100000 || rounds > 2000000 || !saltText || !expectedText) {
    throw new FunctionError(503, 'A configuração da autorização especial é inválida.');
  }

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = decodeBase64(saltText);
    expected = decodeBase64(expectedText);
  } catch {
    throw new FunctionError(503, 'A configuração da autorização especial é inválida.');
  }
  if (salt.length < 16 || expected.length !== 32) {
    throw new FunctionError(503, 'A configuração da autorização especial é inválida.');
  }

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const actual = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds },
    key,
    256,
  ));
  return constantTimeEqual(actual, expected);
}

function safeUser(user: Record<string, unknown>, role?: Record<string, unknown>) {
  const metadata = user.user_metadata && typeof user.user_metadata === 'object'
    ? user.user_metadata as Record<string, unknown>
    : {};
  const bannedUntil = typeof user.banned_until === 'string' ? user.banned_until : null;
  const authActive = !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
  return {
    id: String(user.id ?? ''),
    email: typeof user.email === 'string' ? user.email : '',
    name: typeof metadata.name === 'string' ? metadata.name : '',
    username: typeof metadata.username === 'string' ? metadata.username : '',
    createdAt: typeof user.created_at === 'string' ? user.created_at : null,
    lastSignInAt: typeof user.last_sign_in_at === 'string' ? user.last_sign_in_at : null,
    isAdmin: role ? role.is_primary === true || role.is_admin === true : false,
    isActive: role?.is_active !== false && authActive,
    isPrimary: role?.is_primary === true,
  };
}

async function listUsers(admin: Awaited<ReturnType<typeof requireAdministrator>>['admin']) {
  const users: Record<string, unknown>[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new FunctionError(502, 'Não foi possível carregar a lista de usuários.');
    const batch = data.users as unknown as Record<string, unknown>[];
    users.push(...batch);
    if (batch.length < 1000) break;
  }

  const { data: roles, error: rolesError } = await admin
    .from(ADMIN_TABLE)
    .select('user_id,is_primary,is_admin,is_active');
  if (rolesError) throw new FunctionError(502, 'Não foi possível carregar as permissões dos usuários.');
  const roleById = new Map((roles ?? []).map((role) => [role.user_id as string, role as Record<string, unknown>]));
  return users.map((user) => safeUser(user, roleById.get(String(user.id))));
}

async function readTarget(admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'], userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new FunctionError(404, 'Usuário não encontrado.');
  return data.user;
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

    if (body.action === 'list') {
      const [users, auditResult] = await Promise.all([
        listUsers(admin),
        admin.from('kelly_admin_user_audit_v1')
          .select('id,actor_user_id,target_user_id,target_email,action,created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (auditResult.error) throw new FunctionError(502, 'Não foi possível carregar o histórico de acesso removido.');
      return response(request, { users, audit: auditResult.data ?? [] });
    }

    if (body.action === 'create') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (name.length < 2 || username.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
        throw new FunctionError(400, 'Informe nome, usuário, e-mail válido e uma senha com pelo menos 10 caracteres.');
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, username },
      });
      if (error || !data.user) throw new FunctionError(400, 'Não foi possível criar a conta. Confira se o e-mail já está em uso.');

      const { error: roleError } = await admin.from(ADMIN_TABLE).insert({
        user_id: data.user.id,
        is_primary: false,
        is_admin: true,
        is_active: true,
      });
      if (roleError) {
        await admin.auth.admin.updateUserById(data.user.id, { ban_duration: AUTH_BAN_DURATION });
        throw new FunctionError(502, 'A conta foi bloqueada porque não foi possível concluir a configuração administrativa.');
      }
      return response(request, { user: safeUser(data.user as unknown as Record<string, unknown>, { is_admin: true, is_active: true }) }, 201);
    }

    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) throw new FunctionError(400, 'Identificador de usuário inválido.');
    const target = await readTarget(admin, userId);

    if (body.action === 'update') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (name.length < 2 || username.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (password && password.length < 10)) {
        throw new FunctionError(400, 'Confira nome, usuário, e-mail e tamanho da senha informada.');
      }
      const metadata = target.user_metadata && typeof target.user_metadata === 'object'
        ? target.user_metadata as Record<string, unknown>
        : {};
      const attributes = {
        email,
        user_metadata: { ...metadata, name, username },
        ...(password ? { password } : {}),
      };
      const { data, error } = await admin.auth.admin.updateUserById(userId, attributes);
      if (error || !data.user) throw new FunctionError(400, 'Não foi possível atualizar a conta.');
      const { data: role } = await admin.from(ADMIN_TABLE).select('is_primary,is_admin,is_active').eq('user_id', userId).maybeSingle();
      return response(request, { user: safeUser(data.user as unknown as Record<string, unknown>, role as Record<string, unknown> | undefined) });
    }

    if (body.action === 'set-active' || body.action === 'delete') {
      const activate = body.action === 'set-active' && body.isActive === true;
      if (!activate && userId === actor.id) throw new FunctionError(400, 'Você não pode bloquear ou remover o acesso da própria conta.');

      if (body.action === 'delete') {
        const suppliedPassword = typeof body.authorizationPassword === 'string' ? body.authorizationPassword : '';
        const isAuthorized = await matchesAuthorizationPassword(suppliedPassword);
        if (!isAuthorized) throw new FunctionError(403, 'A senha especial de autorização está incorreta.');
      }

      const { error: authError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: activate ? 'none' : AUTH_BAN_DURATION,
      });
      if (authError) throw new FunctionError(400, 'Não foi possível alterar o acesso da conta.');

      if (!activate) {
        const { error: auditError } = await admin.rpc('kelly_soft_deactivate_admin_v1', {
          p_actor_user_id: actor.id,
          p_target_user_id: userId,
          p_target_email: target.email ?? '',
        });
        if (auditError) {
          await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
          throw new FunctionError(409, auditError.message.includes('último administrador')
            ? 'O último administrador ativo não pode ser removido.'
            : auditError.message.includes('própria conta')
              ? 'Você não pode remover sua própria conta.'
              : 'Não foi possível concluir a alteração de acesso.');
        }
      } else {
        const { error: roleError } = await admin.from(ADMIN_TABLE)
          .update({ is_active: true })
          .eq('user_id', userId);
        if (roleError) {
          await admin.auth.admin.updateUserById(userId, { ban_duration: AUTH_BAN_DURATION });
          throw new FunctionError(502, 'Não foi possível concluir a reativação da conta.');
        }
      }

      const refreshed = await readTarget(admin, userId);
      const { data: role } = await admin.from(ADMIN_TABLE).select('is_primary,is_admin,is_active').eq('user_id', userId).maybeSingle();
      return response(request, { user: safeUser(refreshed as unknown as Record<string, unknown>, role as Record<string, unknown> | undefined) });
    }

    throw new FunctionError(400, 'Ação de gerenciamento desconhecida.');
  } catch (error) {
    const status = error instanceof FunctionError ? error.status : 500;
    const message = error instanceof FunctionError ? error.message : 'Não foi possível concluir a operação. Tente novamente.';
    return response(request, { error: message }, status);
  }
});

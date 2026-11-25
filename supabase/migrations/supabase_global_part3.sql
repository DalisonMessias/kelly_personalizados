create table if not exists public.kelly_user_data_snapshots_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  data_key text not null,
  data_value jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists kelly_user_data_snapshots_user_key_created_idx
  on public.kelly_user_data_snapshots_v1 (user_id, data_key, created_at desc);

alter table public.kelly_user_data_snapshots_v1 enable row level security;

grant select, insert on table public.kelly_user_data_snapshots_v1 to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kelly_user_data_snapshots_v1'
      and policyname = 'kelly_user_data_snapshots_select_own'
  ) then
    create policy kelly_user_data_snapshots_select_own
      on public.kelly_user_data_snapshots_v1
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kelly_user_data_snapshots_v1'
      and policyname = 'kelly_user_data_snapshots_insert_own'
  ) then
    create policy kelly_user_data_snapshots_insert_own
      on public.kelly_user_data_snapshots_v1
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
end
$$;

-- Habilita a transmissão segura de novos snapshots para sincronizar a página de configurações.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'kelly_user_data_snapshots_v1'
  ) then
    execute 'alter publication supabase_realtime add table public.kelly_user_data_snapshots_v1';
  end if;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kelly_private_quote_assets_v1',
  'kelly_private_quote_assets_v1',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'kelly_quote_assets_select_own'
  ) then
    create policy kelly_quote_assets_select_own
      on storage.objects
      for select to authenticated
      using (
        bucket_id = 'kelly_private_quote_assets_v1'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'kelly_quote_assets_insert_own'
  ) then
    create policy kelly_quote_assets_insert_own
      on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'kelly_private_quote_assets_v1'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'kelly_quote_assets_update_own'
  ) then
    create policy kelly_quote_assets_update_own
      on storage.objects
      for update to authenticated
      using (
        bucket_id = 'kelly_private_quote_assets_v1'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'kelly_private_quote_assets_v1'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end
$$;


-- Estruturas aditivas da loja virtual pública Kelly Personalizados.
create table if not exists public.kelly_storefront_admins_v1 (
  user_id uuid primary key,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists kelly_storefront_admins_one_primary_idx
  on public.kelly_storefront_admins_v1 (is_primary) where is_primary;

insert into public.kelly_storefront_admins_v1 (user_id, is_primary)
select owners.user_id, owners.user_id = (
  select snapshots.user_id
  from public.kelly_user_data_snapshots_v1 as snapshots
  group by snapshots.user_id
  order by max(snapshots.created_at) desc
  limit 1
)
from (
  select distinct user_id from public.kelly_user_data_snapshots_v1
) as owners
on conflict (user_id) do nothing;

alter table public.kelly_storefront_admins_v1 enable row level security;

create table if not exists public.kelly_storefront_orders_v1 (
  id uuid primary key,
  order_number text not null unique,
  customer_name text not null,
  customer_whatsapp text not null,
  product_id text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  personalizations jsonb not null default '{}'::jsonb,
  customer_text text not null default '',
  theme_colors text not null default '',
  notes text not null default '',
  reference_path text,
  estimated_unit_price numeric(12,2),
  estimated_total numeric(12,2),
  status text not null default 'novo' check (status in ('novo','em_analise','aguardando_confirmacao','em_producao','pronto','entregue','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kelly_storefront_orders_status_created_idx
  on public.kelly_storefront_orders_v1 (status, created_at desc);
create index if not exists kelly_storefront_orders_phone_created_idx
  on public.kelly_storefront_orders_v1 (customer_whatsapp, created_at desc);

create table if not exists public.kelly_storefront_order_history_v1 (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.kelly_storefront_orders_v1(id) on delete restrict,
  previous_status text,
  new_status text not null check (new_status in ('novo','em_analise','aguardando_confirmacao','em_producao','pronto','entregue','cancelado')),
  note text not null default '',
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists kelly_storefront_order_history_order_created_idx
  on public.kelly_storefront_order_history_v1 (order_id, created_at desc);

alter table public.kelly_storefront_orders_v1 enable row level security;
alter table public.kelly_storefront_order_history_v1 enable row level security;
revoke all on table public.kelly_storefront_admins_v1 from anon, authenticated;
revoke all on table public.kelly_storefront_orders_v1 from anon, authenticated;
revoke all on table public.kelly_storefront_order_history_v1 from anon, authenticated;

create or replace function public.kelly_is_storefront_admin_v1()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.kelly_storefront_admins_v1
    where user_id = auth.uid()
  );
$$;

create or replace function public.kelly_storefront_owner_v1()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.kelly_storefront_admins_v1
  where is_primary
  limit 1;
$$;

revoke all on function public.kelly_is_storefront_admin_v1() from public, anon;
grant execute on function public.kelly_is_storefront_admin_v1() to authenticated;
revoke all on function public.kelly_storefront_owner_v1() from public, anon, authenticated;

create or replace function public.kelly_get_storefront_catalog_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_products jsonb;
  v_categories jsonb;
begin
  v_owner := public.kelly_storefront_owner_v1();
  if v_owner is null then
    return jsonb_build_object('products', '[]'::jsonb, 'categories', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', product.value->>'id',
      'name', product.value->>'name',
      'publicDescription', coalesce(product.value->>'publicDescription', ''),
      'category', coalesce(product.value->>'category', 'outro'),
      'imageIds', case when jsonb_typeof(product.value->'imageIds') = 'array' then product.value->'imageIds' else '[]'::jsonb end,
      'minimumQuantity', case when coalesce(product.value->>'minimumQuantity','') ~ '^[0-9]+$' then greatest(1, (product.value->>'minimumQuantity')::integer) else 1 end,
      'productionDeadline', coalesce(product.value->>'productionDeadline', ''),
      'salePrice', case when coalesce(product.value->>'salePrice','') ~ '^[0-9]+([.][0-9]{1,2})?$' then to_jsonb((product.value->>'salePrice')::numeric) else 'null'::jsonb end,
      'personalizationOptions', case
        when jsonb_typeof(product.value->'personalizationOptions') = 'array' then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', option.value->>'id',
            'name', option.value->>'name',
            'type', option.value->>'type',
            'required', coalesce((option.value->>'required')::boolean, false),
            'values', case when jsonb_typeof(option.value->'values') = 'array' then option.value->'values' else '[]'::jsonb end,
            'priceAdjustment', case when coalesce(option.value->>'priceAdjustment','') ~ '^-?[0-9]+([.][0-9]{1,2})?$' then to_jsonb((option.value->>'priceAdjustment')::numeric) else '0'::jsonb end
          ))
          from jsonb_array_elements(product.value->'personalizationOptions') as option(value)
          where coalesce((option.value->>'active')::boolean, false)
        ), '[]'::jsonb) else '[]'::jsonb end,
      'addons', case
        when jsonb_typeof(product.value->'addons') = 'array' then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', addon.value->>'id',
            'name', addon.value->>'name',
            'description', coalesce(addon.value->>'description',''),
            'price', case when coalesce(addon.value->>'price','') ~ '^[0-9]+([.][0-9]{1,2})?$' then to_jsonb((addon.value->>'price')::numeric) else '0'::jsonb end
          ))
          from jsonb_array_elements(product.value->'addons') as addon(value)
          where coalesce((addon.value->>'active')::boolean, false)
        ), '[]'::jsonb) else '[]'::jsonb end
    ) order by lower(coalesce(product.value->>'name',''))
  ), '[]'::jsonb) into v_products
  from public.kelly_user_data_snapshots_v1 as snapshot
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(snapshot.data_value) = 'array' then snapshot.data_value else '[]'::jsonb end
  ) as product(value)
  where snapshot.user_id = v_owner
    and snapshot.data_key = 'kelly_store_products_v1'
    and coalesce(product.value->>'status','') = 'ativo'
    and coalesce((product.value->>'showInFutureStore')::boolean, false);

  select coalesce(jsonb_agg(jsonb_build_object('id', category.value->>'id', 'name', category.value->>'name') order by lower(coalesce(category.value->>'name',''))), '[]'::jsonb)
    into v_categories
  from public.kelly_user_data_snapshots_v1 as snapshot
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(snapshot.data_value) = 'array' then snapshot.data_value else '[]'::jsonb end
  ) as category(value)
  where snapshot.user_id = v_owner
    and snapshot.data_key = 'kelly_store_categories_v1'
    and coalesce((category.value->>'active')::boolean, false);

  return jsonb_build_object('products', coalesce(v_products, '[]'::jsonb), 'categories', coalesce(v_categories, '[]'::jsonb));
end;
$$;

create or replace function public.kelly_submit_storefront_order_v1(
  p_request_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_product_id text,
  p_quantity integer,
  p_personalizations jsonb default '{}'::jsonb,
  p_customer_text text default '',
  p_theme_colors text default '',
  p_notes text default '',
  p_reference_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_catalog jsonb;
  v_product jsonb;
  v_minimum integer;
  v_price numeric(12,2);
  v_unit_price numeric(12,2);
  v_total numeric(12,2);
  v_phone text;
  v_order_number text;
  v_count integer;
begin
  if p_request_id is null then raise exception 'Solicitação inválida.'; end if;
  if length(trim(coalesce(p_customer_name,''))) < 2 or length(trim(p_customer_name)) > 120 then raise exception 'Informe um nome válido.'; end if;
  v_phone := regexp_replace(coalesce(p_customer_whatsapp,''), '[^0-9]', '', 'g');
  if length(v_phone) < 10 or length(v_phone) > 15 then raise exception 'Informe um WhatsApp válido.'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 9999 then raise exception 'Quantidade inválida.'; end if;
  if length(coalesce(p_product_id,'')) < 1 or length(p_product_id) > 160 then raise exception 'Produto inválido.'; end if;
  if jsonb_typeof(coalesce(p_personalizations, '{}'::jsonb)) <> 'object' or length(coalesce(p_personalizations, '{}'::jsonb)::text) > 5000 then raise exception 'Personalizações inválidas.'; end if;
  if length(coalesce(p_customer_text,'')) > 500 or length(coalesce(p_theme_colors,'')) > 300 or length(coalesce(p_notes,'')) > 2000 then raise exception 'Os detalhes do pedido excedem o limite permitido.'; end if;
  if p_reference_path is not null and p_reference_path !~ ('^' || p_request_id::text || '/[0-9a-f-]{36}[.](png|jpg|jpeg|webp)$') then raise exception 'Arquivo de referência inválido.'; end if;

  select count(*) into v_count from public.kelly_storefront_orders_v1
  where customer_whatsapp = v_phone and created_at > now() - interval '10 minutes';
  if v_count >= 3 then raise exception 'Limite temporário de solicitações atingido. Tente novamente mais tarde.'; end if;

  v_catalog := public.kelly_get_storefront_catalog_v1();
  select item into v_product
  from jsonb_array_elements(coalesce(v_catalog->'products','[]'::jsonb)) as item
  where item->>'id' = p_product_id
  limit 1;
  if v_product is null then raise exception 'Este produto não está disponível para solicitação.'; end if;

  v_minimum := case when coalesce(v_product->>'minimumQuantity','') ~ '^[0-9]+$' then greatest(1, (v_product->>'minimumQuantity')::integer) else 1 end;
  if p_quantity < v_minimum then raise exception 'A quantidade está abaixo do mínimo deste produto.'; end if;
  if coalesce(v_product->>'salePrice','') ~ '^[0-9]+([.][0-9]{1,2})?$' then v_price := (v_product->>'salePrice')::numeric; else v_price := null; end if;
  if v_price is not null and v_price > 0 then
    v_unit_price := round(v_price / v_minimum, 2);
    v_total := round(v_unit_price * p_quantity, 2);
  end if;

  v_order_number := 'KP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.kelly_storefront_orders_v1 (
    id, order_number, customer_name, customer_whatsapp, product_id, product_name, quantity,
    personalizations, customer_text, theme_colors, notes, reference_path, estimated_unit_price, estimated_total
  ) values (
    p_request_id, v_order_number, trim(p_customer_name), v_phone, p_product_id,
    coalesce(v_product->>'name','Produto'), p_quantity, coalesce(p_personalizations, '{}'::jsonb),
    trim(coalesce(p_customer_text,'')), trim(coalesce(p_theme_colors,'')), trim(coalesce(p_notes,'')),
    p_reference_path, v_unit_price, v_total
  );

  insert into public.kelly_storefront_order_history_v1 (order_id, new_status, note)
  values (p_request_id, 'novo', 'Solicitação recebida pela loja virtual.');

  return jsonb_build_object('id', p_request_id, 'orderNumber', v_order_number, 'status', 'novo', 'estimatedUnitPrice', v_unit_price, 'estimatedTotal', v_total, 'createdAt', now());
end;
$$;

create or replace function public.kelly_get_storefront_orders_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_orders jsonb;
begin
  if not public.kelly_is_storefront_admin_v1() then raise exception 'Acesso administrativo necessário.'; end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', orders.id, 'orderNumber', orders.order_number, 'customerName', orders.customer_name,
      'customerWhatsapp', orders.customer_whatsapp, 'productId', orders.product_id, 'productName', orders.product_name,
      'quantity', orders.quantity, 'personalizations', orders.personalizations, 'customerText', orders.customer_text,
      'themeColors', orders.theme_colors, 'notes', orders.notes, 'referencePath', orders.reference_path,
      'estimatedUnitPrice', orders.estimated_unit_price, 'estimatedTotal', orders.estimated_total,
      'status', orders.status, 'createdAt', orders.created_at, 'updatedAt', orders.updated_at,
      'history', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', history.id, 'previousStatus', history.previous_status, 'newStatus', history.new_status,
          'note', history.note, 'createdAt', history.created_at
        ) order by history.created_at desc)
        from public.kelly_storefront_order_history_v1 as history where history.order_id = orders.id
      ), '[]'::jsonb)
    ) order by orders.created_at desc
  ), '[]'::jsonb) into v_orders
  from (select * from public.kelly_storefront_orders_v1 order by created_at desc limit 500) as orders;
  return v_orders;
end;
$$;

create or replace function public.kelly_set_storefront_order_status_v1(p_order_id uuid, p_status text, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous text;
begin
  if not public.kelly_is_storefront_admin_v1() then raise exception 'Acesso administrativo necessário.'; end if;
  if p_status not in ('novo','em_analise','aguardando_confirmacao','em_producao','pronto','entregue','cancelado') then raise exception 'Situação inválida.'; end if;
  if length(coalesce(p_note,'')) > 500 then raise exception 'A observação excede o limite permitido.'; end if;
  select status into v_previous from public.kelly_storefront_orders_v1 where id = p_order_id for update;
  if v_previous is null then raise exception 'Solicitação não encontrada.'; end if;
  if v_previous = p_status then return jsonb_build_object('id', p_order_id, 'status', p_status); end if;
  update public.kelly_storefront_orders_v1 set status = p_status, updated_at = now() where id = p_order_id;
  insert into public.kelly_storefront_order_history_v1 (order_id, previous_status, new_status, note, actor_user_id)
  values (p_order_id, v_previous, p_status, trim(coalesce(p_note,'')), auth.uid());
  return jsonb_build_object('id', p_order_id, 'previousStatus', v_previous, 'status', p_status);
end;
$$;

create or replace function public.kelly_can_upload_storefront_reference_v1(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.kelly_storefront_orders_v1
    where reference_path = p_path and created_at > now() - interval '30 minutes'
  );
$$;

revoke all on function public.kelly_get_storefront_catalog_v1() from public;
grant execute on function public.kelly_get_storefront_catalog_v1() to anon, authenticated;
revoke all on function public.kelly_submit_storefront_order_v1(uuid,text,text,text,integer,jsonb,text,text,text,text) from public;
grant execute on function public.kelly_submit_storefront_order_v1(uuid,text,text,text,integer,jsonb,text,text,text,text) to anon, authenticated;
revoke all on function public.kelly_get_storefront_orders_v1() from public, anon;
grant execute on function public.kelly_get_storefront_orders_v1() to authenticated;
revoke all on function public.kelly_set_storefront_order_status_v1(uuid,text,text) from public, anon;
grant execute on function public.kelly_set_storefront_order_status_v1(uuid,text,text) to authenticated;
revoke all on function public.kelly_can_upload_storefront_reference_v1(text) from public;
grant execute on function public.kelly_can_upload_storefront_reference_v1(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kelly_public_store_assets_v1', 'kelly_public_store_assets_v1', true, 8388608, array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kelly_private_store_references_v1', 'kelly_private_store_references_v1', false, 10485760, array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='kelly_public_store_assets_insert_admin_v1') then
    create policy kelly_public_store_assets_insert_admin_v1 on storage.objects
      for insert to authenticated
      with check (bucket_id='kelly_public_store_assets_v1' and (storage.foldername(name))[1]='store-product' and public.kelly_is_storefront_admin_v1());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='kelly_private_store_references_insert_order_v1') then
    create policy kelly_private_store_references_insert_order_v1 on storage.objects
      for insert to anon, authenticated
      with check (bucket_id='kelly_private_store_references_v1' and public.kelly_can_upload_storefront_reference_v1(name));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='kelly_private_store_references_select_admin_v1') then
    create policy kelly_private_store_references_select_admin_v1 on storage.objects
      for select to authenticated
      using (bucket_id='kelly_private_store_references_v1' and public.kelly_is_storefront_admin_v1());
  end if;
end
$$;


-- Complementos aditivos: preservar pedidos com adicionais e ler somente o snapshot mais recente.
alter table public.kelly_storefront_orders_v1
  add column if not exists selected_addons jsonb not null default '[]'::jsonb;

create or replace function public.kelly_get_storefront_catalog_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_products jsonb;
  v_categories jsonb;
begin
  v_owner := public.kelly_storefront_owner_v1();
  if v_owner is null then
    return jsonb_build_object('products', '[]'::jsonb, 'categories', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', product.value->>'id',
      'name', product.value->>'name',
      'publicDescription', coalesce(product.value->>'publicDescription', ''),
      'category', coalesce(product.value->>'category', 'outro'),
      'imageIds', case when jsonb_typeof(product.value->'imageIds') = 'array' then product.value->'imageIds' else '[]'::jsonb end,
      'minimumQuantity', case when coalesce(product.value->>'minimumQuantity','') ~ '^[0-9]+$' then greatest(1, (product.value->>'minimumQuantity')::integer) else 1 end,
      'productionDeadline', coalesce(product.value->>'productionDeadline', ''),
      'salePrice', case when coalesce(product.value->>'salePrice','') ~ '^[0-9]+([.][0-9]{1,2})?$' then to_jsonb((product.value->>'salePrice')::numeric) else 'null'::jsonb end,
      'personalizationOptions', case
        when jsonb_typeof(product.value->'personalizationOptions') = 'array' then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', option.value->>'id', 'name', option.value->>'name', 'type', option.value->>'type',
            'required', coalesce((option.value->>'required')::boolean, false),
            'values', case when jsonb_typeof(option.value->'values') = 'array' then option.value->'values' else '[]'::jsonb end,
            'priceAdjustment', case when coalesce(option.value->>'priceAdjustment','') ~ '^-?[0-9]+([.][0-9]{1,2})?$' then to_jsonb((option.value->>'priceAdjustment')::numeric) else '0'::jsonb end
          ))
          from jsonb_array_elements(product.value->'personalizationOptions') as option(value)
          where coalesce((option.value->>'active')::boolean, false)
        ), '[]'::jsonb) else '[]'::jsonb end,
      'addons', case
        when jsonb_typeof(product.value->'addons') = 'array' then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', addon.value->>'id', 'name', addon.value->>'name',
            'description', coalesce(addon.value->>'description',''),
            'price', case when coalesce(addon.value->>'price','') ~ '^[0-9]+([.][0-9]{1,2})?$' then to_jsonb((addon.value->>'price')::numeric) else '0'::jsonb end
          ))
          from jsonb_array_elements(product.value->'addons') as addon(value)
          where coalesce((addon.value->>'active')::boolean, false)
        ), '[]'::jsonb) else '[]'::jsonb end
    ) order by lower(coalesce(product.value->>'name',''))
  ), '[]'::jsonb) into v_products
  from (
    select data_value from public.kelly_user_data_snapshots_v1
    where user_id = v_owner and data_key = 'kelly_store_products_v1'
    order by created_at desc limit 1
  ) as snapshot
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(snapshot.data_value) = 'array' then snapshot.data_value else '[]'::jsonb end
  ) as product(value)
  where coalesce(product.value->>'status','') = 'ativo'
    and coalesce((product.value->>'showInFutureStore')::boolean, false);

  select coalesce(jsonb_agg(jsonb_build_object('id', category.value->>'id', 'name', category.value->>'name') order by lower(coalesce(category.value->>'name',''))), '[]'::jsonb)
    into v_categories
  from (
    select data_value from public.kelly_user_data_snapshots_v1
    where user_id = v_owner and data_key = 'kelly_store_categories_v1'
    order by created_at desc limit 1
  ) as snapshot
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(snapshot.data_value) = 'array' then snapshot.data_value else '[]'::jsonb end
  ) as category(value)
  where coalesce((category.value->>'active')::boolean, false);

  return jsonb_build_object('products', coalesce(v_products, '[]'::jsonb), 'categories', coalesce(v_categories, '[]'::jsonb));
end;
$$;

create or replace function public.kelly_get_storefront_orders_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_orders jsonb;
begin
  if not public.kelly_is_storefront_admin_v1() then raise exception 'Acesso administrativo necessário.'; end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', orders.id, 'orderNumber', orders.order_number, 'customerName', orders.customer_name,
      'customerWhatsapp', orders.customer_whatsapp, 'productId', orders.product_id, 'productName', orders.product_name,
      'quantity', orders.quantity, 'personalizations', orders.personalizations, 'selectedAddons', orders.selected_addons,
      'customerText', orders.customer_text, 'themeColors', orders.theme_colors, 'notes', orders.notes,
      'referencePath', orders.reference_path, 'estimatedUnitPrice', orders.estimated_unit_price,
      'estimatedTotal', orders.estimated_total, 'status', orders.status, 'createdAt', orders.created_at, 'updatedAt', orders.updated_at,
      'history', coalesce((select jsonb_agg(jsonb_build_object(
        'id', history.id, 'previousStatus', history.previous_status, 'newStatus', history.new_status,
        'note', history.note, 'createdAt', history.created_at
      ) order by history.created_at desc) from public.kelly_storefront_order_history_v1 as history where history.order_id = orders.id), '[]'::jsonb)
    ) order by orders.created_at desc
  ), '[]'::jsonb) into v_orders
  from (select * from public.kelly_storefront_orders_v1 order by created_at desc limit 500) as orders;
  return v_orders;
end;
$$;

create or replace function public.kelly_submit_storefront_order_v1(
  p_request_id uuid, p_customer_name text, p_customer_whatsapp text, p_product_id text, p_quantity integer,
  p_personalizations jsonb, p_customer_text text, p_theme_colors text, p_notes text, p_reference_path text, p_selected_addons jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product jsonb;
  v_addon jsonb;
  v_addon_id text;
  v_addon_price numeric(12,2) := 0;
  v_result jsonb;
  v_unit numeric(12,2);
  v_total numeric(12,2);
begin
  if jsonb_typeof(coalesce(p_selected_addons, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_selected_addons, '[]'::jsonb)) > 20 then
    raise exception 'Adicionais inválidos.';
  end if;
  if exists (select value from jsonb_array_elements_text(coalesce(p_selected_addons, '[]'::jsonb)) as selected(value) group by value having count(*) > 1) then
    raise exception 'Adicionais repetidos.';
  end if;

  select product.value into v_product
  from jsonb_array_elements(coalesce(public.kelly_get_storefront_catalog_v1()->'products', '[]'::jsonb)) as product(value)
  where product.value->>'id' = p_product_id limit 1;
  if v_product is null then raise exception 'Este produto não está disponível para solicitação.'; end if;

  for v_addon_id in select value from jsonb_array_elements_text(coalesce(p_selected_addons, '[]'::jsonb)) as selected(value) loop
    select addon.value into v_addon
    from jsonb_array_elements(coalesce(v_product->'addons', '[]'::jsonb)) as addon(value)
    where addon.value->>'id' = v_addon_id limit 1;
    if v_addon is null then raise exception 'Um dos adicionais selecionados não está disponível.'; end if;
    v_addon_price := v_addon_price + coalesce((v_addon->>'price')::numeric, 0);
  end loop;

  v_result := public.kelly_submit_storefront_order_v1(
    p_request_id, p_customer_name, p_customer_whatsapp, p_product_id, p_quantity,
    p_personalizations, p_customer_text, p_theme_colors, p_notes, p_reference_path
  );
  if v_result->>'estimatedUnitPrice' is not null then v_unit := (v_result->>'estimatedUnitPrice')::numeric + v_addon_price; end if;
  if v_result->>'estimatedTotal' is not null then v_total := (v_result->>'estimatedTotal')::numeric + (v_addon_price * p_quantity); end if;
  update public.kelly_storefront_orders_v1
    set selected_addons = coalesce(p_selected_addons, '[]'::jsonb), estimated_unit_price = v_unit, estimated_total = v_total
    where id = p_request_id;
  return jsonb_set(jsonb_set(v_result, '{estimatedUnitPrice}', to_jsonb(v_unit), true), '{estimatedTotal}', to_jsonb(v_total), true);
end;
$$;

revoke all on function public.kelly_submit_storefront_order_v1(uuid,text,text,text,integer,jsonb,text,text,text,text,jsonb) from public;
grant execute on function public.kelly_submit_storefront_order_v1(uuid,text,text,text,integer,jsonb,text,text,text,text,jsonb) to anon, authenticated;


-- Preserva o nome e o preço dos adicionais no momento em que cada pedido é criado.
create or replace function public.kelly_submit_storefront_order_v1(
  p_request_id uuid, p_customer_name text, p_customer_whatsapp text, p_product_id text, p_quantity integer,
  p_personalizations jsonb, p_customer_text text, p_theme_colors text, p_notes text, p_reference_path text, p_selected_addons jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product jsonb;
  v_addon jsonb;
  v_addon_id text;
  v_addon_price numeric(12,2) := 0;
  v_saved_addons jsonb := '[]'::jsonb;
  v_result jsonb;
  v_unit numeric(12,2);
  v_total numeric(12,2);
begin
  if jsonb_typeof(coalesce(p_selected_addons, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_selected_addons, '[]'::jsonb)) > 20 then
    raise exception 'Adicionais inválidos.';
  end if;
  if exists (select value from jsonb_array_elements_text(coalesce(p_selected_addons, '[]'::jsonb)) as selected(value) group by value having count(*) > 1) then
    raise exception 'Adicionais repetidos.';
  end if;

  select product.value into v_product
  from jsonb_array_elements(coalesce(public.kelly_get_storefront_catalog_v1()->'products', '[]'::jsonb)) as product(value)
  where product.value->>'id' = p_product_id limit 1;
  if v_product is null then raise exception 'Este produto não está disponível para solicitação.'; end if;

  for v_addon_id in select value from jsonb_array_elements_text(coalesce(p_selected_addons, '[]'::jsonb)) as selected(value) loop
    select addon.value into v_addon
    from jsonb_array_elements(coalesce(v_product->'addons', '[]'::jsonb)) as addon(value)
    where addon.value->>'id' = v_addon_id limit 1;
    if v_addon is null then raise exception 'Um dos adicionais selecionados não está disponível.'; end if;
    v_addon_price := v_addon_price + coalesce((v_addon->>'price')::numeric, 0);
    v_saved_addons := v_saved_addons || jsonb_build_array(jsonb_build_object(
      'id', v_addon_id, 'name', coalesce(v_addon->>'name','Adicional'), 'price', coalesce((v_addon->>'price')::numeric,0)
    ));
  end loop;

  v_result := public.kelly_submit_storefront_order_v1(
    p_request_id, p_customer_name, p_customer_whatsapp, p_product_id, p_quantity,
    p_personalizations, p_customer_text, p_theme_colors, p_notes, p_reference_path
  );
  if v_result->>'estimatedUnitPrice' is not null then v_unit := (v_result->>'estimatedUnitPrice')::numeric + v_addon_price; end if;
  if v_result->>'estimatedTotal' is not null then v_total := (v_result->>'estimatedTotal')::numeric + (v_addon_price * p_quantity); end if;
  update public.kelly_storefront_orders_v1
    set selected_addons = v_saved_addons, estimated_unit_price = v_unit, estimated_total = v_total
    where id = p_request_id;
  return jsonb_set(jsonb_set(v_result, '{estimatedUnitPrice}', to_jsonb(v_unit), true), '{estimatedTotal}', to_jsonb(v_total), true);
end;
$$;


-- Restringe a administração ao responsável principal e valida campos públicos no banco.
create or replace function public.kelly_is_storefront_admin_v1()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.kelly_storefront_admins_v1
    where user_id = auth.uid() and is_primary
  );
$$;

create or replace function public.kelly_submit_storefront_order_v1(
  p_request_id uuid, p_customer_name text, p_customer_whatsapp text, p_product_id text, p_quantity integer,
  p_personalizations jsonb, p_customer_text text, p_theme_colors text, p_notes text, p_reference_path text, p_selected_addons jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product jsonb;
  v_option jsonb;
  v_addon jsonb;
  v_addon_id text;
  v_addon_price numeric(12,2) := 0;
  v_saved_addons jsonb := '[]'::jsonb;
  v_answers jsonb := coalesce(p_personalizations, '{}'::jsonb);
  v_result jsonb;
  v_unit numeric(12,2);
  v_total numeric(12,2);
begin
  if jsonb_typeof(v_answers) <> 'object' or length(v_answers::text) > 5000 then raise exception 'Personalizações inválidas.'; end if;
  select product.value into v_product
  from jsonb_array_elements(coalesce(public.kelly_get_storefront_catalog_v1()->'products', '[]'::jsonb)) as product(value)
  where product.value->>'id' = p_product_id limit 1;
  if v_product is null then raise exception 'Este produto não está disponível para solicitação.'; end if;

  if exists (
    select 1 from jsonb_each(v_answers) as answer(key, value)
    where not exists (
      select 1 from jsonb_array_elements(coalesce(v_product->'personalizationOptions','[]'::jsonb)) as option(value)
      where coalesce((option.value->>'active')::boolean,false) and option.value->>'name' = answer.key
    )
  ) then raise exception 'Uma personalização enviada não pertence a este produto.'; end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(v_product->'personalizationOptions','[]'::jsonb)) as option(value)
    where coalesce((option.value->>'required')::boolean,false)
      and not (v_answers ? coalesce(option.value->>'name',''))
  ) then raise exception 'Preencha todas as personalizações obrigatórias.'; end if;

  for v_option in select value from jsonb_array_elements(coalesce(v_product->'personalizationOptions','[]'::jsonb)) as options(value) loop
    if not (v_answers ? coalesce(v_option->>'name','')) then continue; end if;
    if v_option->>'type' = 'selecao' and (
      jsonb_typeof(v_answers->(v_option->>'name')) <> 'string'
      or not exists (select 1 from jsonb_array_elements_text(coalesce(v_option->'values','[]'::jsonb)) as allowed(value) where allowed.value = v_answers->>(v_option->>'name'))
    ) then raise exception 'Uma opção de seleção não é válida.'; end if;
    if v_option->>'type' = 'multipla_escolha' and (
      jsonb_typeof(v_answers->(v_option->>'name')) <> 'array'
      or exists (
        select 1 from jsonb_array_elements_text(v_answers->(v_option->>'name')) as chosen(value)
        where not exists (select 1 from jsonb_array_elements_text(coalesce(v_option->'values','[]'::jsonb)) as allowed(value) where allowed.value = chosen.value)
      )
    ) then raise exception 'Uma opção de múltipla escolha não é válida.'; end if;
    if v_option->>'type' = 'sim_nao' and jsonb_typeof(v_answers->(v_option->>'name')) <> 'boolean' then raise exception 'Uma resposta sim ou não não é válida.'; end if;
    if v_option->>'type' = 'numero' and coalesce(v_answers->>(v_option->>'name'),'') !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Informe um número válido na personalização.'; end if;
    if v_option->>'type' = 'texto' and (jsonb_typeof(v_answers->(v_option->>'name')) <> 'string' or length(v_answers->>(v_option->>'name')) > 200) then raise exception 'Uma resposta de texto excede o limite permitido.'; end if;
  end loop;

  if jsonb_typeof(coalesce(p_selected_addons, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_selected_addons, '[]'::jsonb)) > 20 then raise exception 'Adicionais inválidos.'; end if;
  if exists (select value from jsonb_array_elements_text(coalesce(p_selected_addons, '[]'::jsonb)) as selected(value) group by value having count(*) > 1) then raise exception 'Adicionais repetidos.'; end if;
  for v_addon_id in select value from jsonb_array_elements_text(coalesce(p_selected_addons, '[]'::jsonb)) as selected(value) loop
    select addon.value into v_addon from jsonb_array_elements(coalesce(v_product->'addons','[]'::jsonb)) as addon(value) where addon.value->>'id' = v_addon_id limit 1;
    if v_addon is null then raise exception 'Um dos adicionais selecionados não está disponível.'; end if;
    v_addon_price := v_addon_price + coalesce((v_addon->>'price')::numeric,0);
    v_saved_addons := v_saved_addons || jsonb_build_array(jsonb_build_object('id',v_addon_id,'name',coalesce(v_addon->>'name','Adicional'),'price',coalesce((v_addon->>'price')::numeric,0)));
  end loop;

  v_result := public.kelly_submit_storefront_order_v1(
    p_request_id,p_customer_name,p_customer_whatsapp,p_product_id,p_quantity,
    v_answers,p_customer_text,p_theme_colors,p_notes,p_reference_path
  );
  if v_result->>'estimatedUnitPrice' is not null then v_unit := (v_result->>'estimatedUnitPrice')::numeric + v_addon_price; end if;
  if v_result->>'estimatedTotal' is not null then v_total := (v_result->>'estimatedTotal')::numeric + (v_addon_price * p_quantity); end if;
  update public.kelly_storefront_orders_v1 set selected_addons=v_saved_addons, estimated_unit_price=v_unit, estimated_total=v_total where id=p_request_id;
  return jsonb_set(jsonb_set(v_result,'{estimatedUnitPrice}',to_jsonb(v_unit),true),'{estimatedTotal}',to_jsonb(v_total),true);
end;
$$;


-- Mantém o ponto de entrada legado apenas para chamadas internas da função validada.
revoke all on function public.kelly_submit_storefront_order_v1(uuid,text,text,text,integer,jsonb,text,text,text,text) from public, anon, authenticated;


-- Serializa solicitações por WhatsApp para que o limite temporário também cubra envios simultâneos.
create or replace function public.kelly_submit_storefront_order_v1(
  p_request_id uuid, p_customer_name text, p_customer_whatsapp text, p_product_id text, p_quantity integer,
  p_personalizations jsonb, p_customer_text text, p_theme_colors text, p_notes text, p_reference_path text, p_selected_addons jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product jsonb;
  v_option jsonb;
  v_addon jsonb;
  v_addon_id text;
  v_addon_price numeric(12,2) := 0;
  v_saved_addons jsonb := '[]'::jsonb;
  v_answers jsonb := coalesce(p_personalizations, '{}'::jsonb);
  v_result jsonb;
  v_unit numeric(12,2);
  v_total numeric(12,2);
  v_phone text;
begin
  v_phone := regexp_replace(coalesce(p_customer_whatsapp,''), '[^0-9]', '', 'g');
  perform pg_advisory_xact_lock(hashtext(v_phone));
  if jsonb_typeof(v_answers) <> 'object' or length(v_answers::text) > 5000 then raise exception 'Personalizações inválidas.'; end if;
  select product.value into v_product from jsonb_array_elements(coalesce(public.kelly_get_storefront_catalog_v1()->'products','[]'::jsonb)) as product(value) where product.value->>'id' = p_product_id limit 1;
  if v_product is null then raise exception 'Este produto não está disponível para solicitação.'; end if;
  if exists (select 1 from jsonb_each(v_answers) as answer(key,value) where not exists (select 1 from jsonb_array_elements(coalesce(v_product->'personalizationOptions','[]'::jsonb)) as option(value) where coalesce((option.value->>'active')::boolean,false) and option.value->>'name'=answer.key)) then raise exception 'Uma personalização enviada não pertence a este produto.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(v_product->'personalizationOptions','[]'::jsonb)) as option(value) where coalesce((option.value->>'required')::boolean,false) and not (v_answers ? coalesce(option.value->>'name',''))) then raise exception 'Preencha todas as personalizações obrigatórias.'; end if;
  for v_option in select value from jsonb_array_elements(coalesce(v_product->'personalizationOptions','[]'::jsonb)) as options(value) loop
    if not (v_answers ? coalesce(v_option->>'name','')) then continue; end if;
    if v_option->>'type'='selecao' and (jsonb_typeof(v_answers->(v_option->>'name'))<>'string' or not exists (select 1 from jsonb_array_elements_text(coalesce(v_option->'values','[]'::jsonb)) as allowed(value) where allowed.value=v_answers->>(v_option->>'name'))) then raise exception 'Uma opção de seleção não é válida.'; end if;
    if v_option->>'type'='multipla_escolha' and (jsonb_typeof(v_answers->(v_option->>'name'))<>'array' or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(v_answers->(v_option->>'name'))='array' then v_answers->(v_option->>'name') else '[]'::jsonb end) as chosen(value) where not exists (select 1 from jsonb_array_elements_text(coalesce(v_option->'values','[]'::jsonb)) as allowed(value) where allowed.value=chosen.value))) then raise exception 'Uma opção de múltipla escolha não é válida.'; end if;
    if v_option->>'type'='sim_nao' and jsonb_typeof(v_answers->(v_option->>'name'))<>'boolean' then raise exception 'Uma resposta sim ou não não é válida.'; end if;
    if v_option->>'type'='numero' and coalesce(v_answers->>(v_option->>'name'),'') !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Informe um número válido na personalização.'; end if;
    if v_option->>'type'='texto' and (jsonb_typeof(v_answers->(v_option->>'name'))<>'string' or length(v_answers->>(v_option->>'name'))>200) then raise exception 'Uma resposta de texto excede o limite permitido.'; end if;
  end loop;
  if jsonb_typeof(coalesce(p_selected_addons,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_selected_addons,'[]'::jsonb))>20 then raise exception 'Adicionais inválidos.'; end if;
  if exists (select value from jsonb_array_elements_text(coalesce(p_selected_addons,'[]'::jsonb)) as selected(value) group by value having count(*)>1) then raise exception 'Adicionais repetidos.'; end if;
  for v_addon_id in select value from jsonb_array_elements_text(coalesce(p_selected_addons,'[]'::jsonb)) as selected(value) loop
    select addon.value into v_addon from jsonb_array_elements(coalesce(v_product->'addons','[]'::jsonb)) as addon(value) where addon.value->>'id'=v_addon_id limit 1;
    if v_addon is null then raise exception 'Um dos adicionais selecionados não está disponível.'; end if;
    v_addon_price:=v_addon_price+coalesce((v_addon->>'price')::numeric,0);
    v_saved_addons:=v_saved_addons||jsonb_build_array(jsonb_build_object('id',v_addon_id,'name',coalesce(v_addon->>'name','Adicional'),'price',coalesce((v_addon->>'price')::numeric,0)));
  end loop;
  v_result:=public.kelly_submit_storefront_order_v1(p_request_id,p_customer_name,p_customer_whatsapp,p_product_id,p_quantity,v_answers,p_customer_text,p_theme_colors,p_notes,p_reference_path);
  if v_result->>'estimatedUnitPrice' is not null then v_unit:=(v_result->>'estimatedUnitPrice')::numeric+v_addon_price; end if;
  if v_result->>'estimatedTotal' is not null then v_total:=(v_result->>'estimatedTotal')::numeric+(v_addon_price*p_quantity); end if;
  update public.kelly_storefront_orders_v1 set selected_addons=v_saved_addons,estimated_unit_price=v_unit,estimated_total=v_total where id=p_request_id;
  return jsonb_set(jsonb_set(v_result,'{estimatedUnitPrice}',to_jsonb(v_unit),true),'{estimatedTotal}',to_jsonb(v_total),true);
end;
$$;


-- Versão final do envio: agrega os ajustes de preço das personalizações no cálculo do pedido.
create or replace function public.kelly_submit_storefront_order_v1(
  p_request_id uuid, p_customer_name text, p_customer_whatsapp text, p_product_id text, p_quantity integer,
  p_personalizations jsonb, p_customer_text text, p_theme_colors text, p_notes text, p_reference_path text,
  p_selected_addons jsonb, p_calculation_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product jsonb;
  v_option jsonb;
  v_adjustment numeric(12,2) := 0;
  v_result jsonb;
  v_unit numeric(12,2);
  v_total numeric(12,2);
  v_answer jsonb;
begin
  if p_calculation_version <> 1 then raise exception 'Versão de cálculo inválida.'; end if;
  v_result := public.kelly_submit_storefront_order_v1(
    p_request_id,p_customer_name,p_customer_whatsapp,p_product_id,p_quantity,
    p_personalizations,p_customer_text,p_theme_colors,p_notes,p_reference_path,p_selected_addons
  );
  if v_result->>'estimatedUnitPrice' is null then return v_result; end if;
  select product.value into v_product
    from jsonb_array_elements(coalesce(public.kelly_get_storefront_catalog_v1()->'products','[]'::jsonb)) as product(value)
    where product.value->>'id'=p_product_id limit 1;
  for v_option in select value from jsonb_array_elements(coalesce(v_product->'personalizationOptions','[]'::jsonb)) as options(value) loop
    if not (coalesce(p_personalizations,'{}'::jsonb) ? coalesce(v_option->>'name','')) then continue; end if;
    v_answer := p_personalizations->(v_option->>'name');
    if coalesce(v_option->>'type','')='sim_nao' and v_answer='false'::jsonb then continue; end if;
    if coalesce(v_option->>'type','')='multipla_escolha' and jsonb_array_length(case when jsonb_typeof(v_answer)='array' then v_answer else '[]'::jsonb end)=0 then continue; end if;
    if coalesce(v_answer::text,'null')='""' then continue; end if;
    v_adjustment:=v_adjustment+coalesce((v_option->>'priceAdjustment')::numeric,0);
  end loop;
  v_unit:=greatest(0,(v_result->>'estimatedUnitPrice')::numeric+v_adjustment);
  v_total:=greatest(0,round(v_unit*p_quantity,2));
  update public.kelly_storefront_orders_v1 set estimated_unit_price=v_unit,estimated_total=v_total where id=p_request_id;
  return jsonb_set(jsonb_set(v_result,'{estimatedUnitPrice}',to_jsonb(v_unit),true),'{estimatedTotal}',to_jsonb(v_total),true);
end;
$$;

revoke all on function public.kelly_submit_storefront_order_v1(uuid,text,text,text,integer,jsonb,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.kelly_submit_storefront_order_v1(uuid,text,text,text,integer,jsonb,text,text,text,text,jsonb,integer) from public;
grant execute on function public.kelly_submit_storefront_order_v1(uuid,text,text,text,integer,jsonb,text,text,text,text,jsonb,integer) to anon, authenticated;


-- Gestão administrativa, auditoria e cópias de segurança, adicionadas sem remover estruturas existentes.
alter table public.kelly_storefront_admins_v1
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_active boolean not null default true;

-- Preserva o acesso administrativo de todas as contas já autorizadas pela função anterior.
update public.kelly_storefront_admins_v1
set is_admin = true
where is_admin = false;

create table if not exists public.kelly_admin_user_audit_v1 (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  target_user_id uuid not null,
  target_email text not null default '',
  action text not null default 'access_deactivated',
  created_at timestamptz not null default now()
);

create index if not exists kelly_admin_user_audit_created_idx
  on public.kelly_admin_user_audit_v1 (created_at desc);

create table if not exists public.kelly_admin_backup_history_v1 (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  backup_data jsonb not null,
  integrity_sha256 text not null,
  created_at timestamptz not null default now()
);

create index if not exists kelly_admin_backup_history_created_idx
  on public.kelly_admin_backup_history_v1 (created_at desc);

alter table public.kelly_admin_user_audit_v1 enable row level security;
alter table public.kelly_admin_backup_history_v1 enable row level security;
revoke all on table public.kelly_admin_user_audit_v1 from public, anon, authenticated;
revoke all on table public.kelly_admin_backup_history_v1 from public, anon, authenticated;
grant all on table public.kelly_admin_user_audit_v1 to service_role;
grant all on table public.kelly_admin_backup_history_v1 to service_role;

create or replace function public.kelly_is_storefront_admin_v1()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.kelly_storefront_admins_v1
    where user_id = auth.uid()
      and is_active
      and (is_primary or is_admin)
  );
$$;

create or replace function public.kelly_get_shared_data_owner_v1()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when public.kelly_is_storefront_admin_v1()
    then public.kelly_storefront_owner_v1()
    else null
  end;
$$;

revoke all on function public.kelly_is_storefront_admin_v1() from public, anon;
grant execute on function public.kelly_is_storefront_admin_v1() to authenticated;
revoke all on function public.kelly_get_shared_data_owner_v1() from public, anon;
grant execute on function public.kelly_get_shared_data_owner_v1() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kelly_user_data_snapshots_v1'
      and policyname = 'kelly_user_data_snapshots_select_shared_admin_v1'
  ) then
    create policy kelly_user_data_snapshots_select_shared_admin_v1
      on public.kelly_user_data_snapshots_v1
      for select to authenticated
      using (
        public.kelly_is_storefront_admin_v1()
        and user_id = public.kelly_storefront_owner_v1()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kelly_user_data_snapshots_v1'
      and policyname = 'kelly_user_data_snapshots_insert_shared_admin_v1'
  ) then
    create policy kelly_user_data_snapshots_insert_shared_admin_v1
      on public.kelly_user_data_snapshots_v1
      for insert to authenticated
      with check (
        public.kelly_is_storefront_admin_v1()
        and user_id = public.kelly_storefront_owner_v1()
      );
  end if;
end
$$;

create or replace function public.kelly_soft_deactivate_admin_v1(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_target_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_is_active_admin boolean := false;
  v_active_admin_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('kelly_admin_user_deactivation_v1'));

  if p_actor_user_id = p_target_user_id then
    raise exception 'Não é permitido desativar a própria conta.';
  end if;

  if not exists (
    select 1 from public.kelly_storefront_admins_v1
    where user_id = p_actor_user_id and is_active and (is_primary or is_admin)
  ) then
    raise exception 'Acesso administrativo necessário.';
  end if;

  select exists (
    select 1 from public.kelly_storefront_admins_v1
    where user_id = p_target_user_id and is_active and (is_primary or is_admin)
  ) into v_target_is_active_admin;

  if v_target_is_active_admin then
    select count(*) into v_active_admin_count
    from public.kelly_storefront_admins_v1
    where is_active and (is_primary or is_admin);
    if v_active_admin_count <= 1 then
      raise exception 'O último administrador ativo não pode ser desativado.';
    end if;
  end if;

  update public.kelly_storefront_admins_v1
  set is_active = false
  where user_id = p_target_user_id;

  insert into public.kelly_admin_user_audit_v1 (actor_user_id, target_user_id, target_email)
  values (p_actor_user_id, p_target_user_id, coalesce(p_target_email, ''));
end;
$$;

revoke all on function public.kelly_soft_deactivate_admin_v1(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.kelly_soft_deactivate_admin_v1(uuid,uuid,text) to service_role;

grant select, insert on table public.kelly_user_data_snapshots_v1 to service_role;
grant select, insert, update on table public.kelly_storefront_admins_v1 to service_role;
grant select, insert on table public.kelly_storefront_orders_v1 to service_role;
grant select, insert on table public.kelly_storefront_order_history_v1 to service_role;
grant execute on function public.kelly_storefront_owner_v1() to service_role;

create or replace function public.kelly_restore_system_backup_v1(
  p_owner_user_id uuid,
  p_actor_user_id uuid,
  p_app_data jsonb,
  p_storefront_orders jsonb,
  p_storefront_order_history jsonb,
  p_backup_data jsonb,
  p_integrity_sha256 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_value jsonb;
  v_allowed_keys text[] := array[
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
    'kelly_store_change_history_v1'
  ];
begin
  if not exists (
    select 1 from public.kelly_storefront_admins_v1
    where user_id = p_actor_user_id and is_active and (is_primary or is_admin)
  ) then
    raise exception 'Acesso administrativo necessário.';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_app_data) loop
    if not (v_key = any(v_allowed_keys)) then
      raise exception 'A cópia contém uma chave de dados desconhecida.';
    end if;
    insert into public.kelly_user_data_snapshots_v1 (user_id, data_key, data_value)
    values (p_owner_user_id, v_key, v_value);
  end loop;

  insert into public.kelly_storefront_orders_v1
  select (jsonb_populate_record(null::public.kelly_storefront_orders_v1, item)).*
  from jsonb_array_elements(coalesce(p_storefront_orders, '[]'::jsonb)) as items(item)
  on conflict (id) do nothing;

  insert into public.kelly_storefront_order_history_v1
  select (jsonb_populate_record(null::public.kelly_storefront_order_history_v1, item)).*
  from jsonb_array_elements(coalesce(p_storefront_order_history, '[]'::jsonb)) as items(item)
  on conflict (id) do nothing;

  insert into public.kelly_admin_backup_history_v1 (created_by, backup_data, integrity_sha256)
  values (p_actor_user_id, p_backup_data, p_integrity_sha256);
end;
$$;

revoke all on function public.kelly_restore_system_backup_v1(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.kelly_restore_system_backup_v1(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.kelly_storefront_owner_v1() to authenticated;

-- Reúne snapshots anteriores na conta principal sem alterar nem remover os snapshots de origem.
do $$
declare
  v_owner_user_id uuid;
  v_data_key text;
  v_data_value jsonb;
  v_data_keys text[] := array[
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
    'kelly_store_change_history_v1'
  ];
begin
  v_owner_user_id := public.kelly_storefront_owner_v1();
  if v_owner_user_id is null then return; end if;

  foreach v_data_key in array v_data_keys loop
    v_data_value := null;

    if v_data_key = 'kelly_calc_settings_v4' then
      select snapshot.data_value into v_data_value
      from public.kelly_storefront_admins_v1 as admin
      join lateral (
        select data_value, created_at
        from public.kelly_user_data_snapshots_v1
        where user_id = admin.user_id and data_key = v_data_key
        order by created_at desc
        limit 1
      ) as snapshot on true
      order by admin.is_primary desc, snapshot.created_at desc
      limit 1;
    else
      select jsonb_agg(entries.data_value order by entries.is_primary desc, entries.created_at asc)
        into v_data_value
      from (
        select distinct on (coalesce(item.value->>'id', md5(item.value::text)))
          item.value as data_value,
          admin.is_primary,
          snapshot.created_at
        from public.kelly_storefront_admins_v1 as admin
        join lateral (
          select data_value, created_at
          from public.kelly_user_data_snapshots_v1
          where user_id = admin.user_id and data_key = v_data_key
          order by created_at desc
          limit 1
        ) as snapshot on true
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(snapshot.data_value) = 'array' then snapshot.data_value else '[]'::jsonb end
        ) as item(value)
        order by coalesce(item.value->>'id', md5(item.value::text)), admin.is_primary desc, snapshot.created_at desc
      ) as entries;
    end if;

    if v_data_value is not null then
      insert into public.kelly_user_data_snapshots_v1 (user_id, data_key, data_value)
      values (v_owner_user_id, v_data_key, v_data_value);
    end if;
  end loop;
end
$$;

-- Arquiva cópias do histórico sem apagar os dados originais.
alter table public.kelly_admin_backup_history_v1
  add column if not exists archived_at timestamptz;

create index if not exists kelly_admin_backup_history_visible_created_idx
  on public.kelly_admin_backup_history_v1 (created_at desc)
  where archived_at is null;

-- Guarda a configuração Gemini do criador de produtos sem expor a chave ao navegador.
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  key_name text not null,
  provider text not null,
  api_key text not null,
  model_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.api_keys
  add column if not exists key_name text,
  add column if not exists provider text,
  add column if not exists api_key text,
  add column if not exists model_name text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists api_keys_product_creator_lookup_idx
  on public.api_keys (key_name, is_active, updated_at desc);

alter table public.api_keys enable row level security;
grant all on table public.api_keys to service_role;

-- 拾光記帳 Daybook V1.1：請在「自己的」Supabase 專案 SQL Editor 執行。
-- 這是資料表與 Row Level Security (RLS)，不會匯入任何真實記帳內容。
-- 永遠不要把 service_role / secret key 填入 GitHub Pages。

create table if not exists public.daybook_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  payload jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id),
  constraint daybook_id_length check (char_length(entry_id) between 1 and 100),
  constraint daybook_payload_size check (payload is null or octet_length(payload::text) < 8192)
);

create table if not exists public.daybook_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  categories jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint daybook_categories_size check (octet_length(categories::text) < 32768)
);

alter table public.daybook_entries enable row level security;
alter table public.daybook_preferences enable row level security;

-- 只允許登入者看到、建立、修改自己帳號所屬的列。
drop policy if exists daybook_entries_select on public.daybook_entries;
create policy daybook_entries_select on public.daybook_entries for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists daybook_entries_insert on public.daybook_entries;
create policy daybook_entries_insert on public.daybook_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists daybook_entries_update on public.daybook_entries;
create policy daybook_entries_update on public.daybook_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists daybook_preferences_select on public.daybook_preferences;
create policy daybook_preferences_select on public.daybook_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists daybook_preferences_insert on public.daybook_preferences;
create policy daybook_preferences_insert on public.daybook_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists daybook_preferences_update on public.daybook_preferences;
create policy daybook_preferences_update on public.daybook_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.daybook_entries, public.daybook_preferences to authenticated;

-- 在 SQL Editor 執行後檢查 RLS 狀態：應為 true。
select relname as table_name, relrowsecurity as rls_enabled
from pg_class where relname in ('daybook_entries','daybook_preferences');


-- V1.5 新增：每一月份預算／固定收支模板各自擁有版本號與刪除標記。
-- 可以重複執行；不更動既有的交易或分類資料。
create table if not exists public.daybook_planner_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  payload jsonb,
  deleted boolean not null default false,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key(user_id,item_key),
  constraint daybook_planner_key_valid check (
    char_length(item_key) between 8 and 160 and (item_key like 'budget:%' or item_key like 'recurring:%')
  ),
  constraint daybook_planner_payload_limit check (payload is null or octet_length(payload::text) < 16384),
  constraint daybook_planner_version_positive check (version >= 1)
);

alter table public.daybook_planner_items enable row level security;
drop policy if exists daybook_planner_select on public.daybook_planner_items;
create policy daybook_planner_select on public.daybook_planner_items for select to authenticated
 using ((select auth.uid())=user_id);
drop policy if exists daybook_planner_insert on public.daybook_planner_items;
create policy daybook_planner_insert on public.daybook_planner_items for insert to authenticated
 with check ((select auth.uid())=user_id);
drop policy if exists daybook_planner_update on public.daybook_planner_items;
create policy daybook_planner_update on public.daybook_planner_items for update to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update on public.daybook_planner_items to authenticated;

-- 避免兩台裝置同時編輯一個項目時，後上傳者悄悄蓋掉先上傳者。
-- 傳入本機上次知道的 version，資料庫以單一原子交易進行條件式變更。
-- 成功回傳新版本號，版本衝突回傳 -1，網站將要求使用者選擇。
create or replace function public.daybook_save_planner_item(
  p_item_key text,
  p_payload jsonb,
  p_deleted boolean,
  p_expected_version bigint
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid;
  v_version bigint;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(p_item_key) < 8 or length(p_item_key) > 160
     or not (p_item_key like 'budget:%' or p_item_key like 'recurring:%') then
     raise exception 'INVALID_PLANNER_KEY';
  end if;
  if p_expected_version < 0 or p_expected_version is null then
     raise exception 'INVALID_EXPECTED_VERSION';
  end if;
  if not p_deleted and p_payload is null then raise exception 'MISSING_PAYLOAD'; end if;
  if octet_length(coalesce(p_payload::text,'')) >= 16384 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if p_expected_version = 0 then
    insert into public.daybook_planner_items(user_id,item_key,payload,deleted,version)
    values(v_user,p_item_key,case when p_deleted then null else p_payload end,p_deleted,1)
    on conflict(user_id,item_key) do nothing
    returning version into v_version;
  else
    update public.daybook_planner_items
       set payload=case when p_deleted then null else p_payload end,
           deleted=p_deleted, version=version+1, updated_at=now()
     where user_id=v_user and item_key=p_item_key and version=p_expected_version
     returning version into v_version;
  end if;
  return coalesce(v_version,-1);
end;
$$;

revoke all on function public.daybook_save_planner_item(text,jsonb,boolean,bigint) from public;
grant execute on function public.daybook_save_planner_item(text,jsonb,boolean,bigint) to authenticated;
notify pgrst, 'reload schema';

select relname as table_name, relrowsecurity as rls_enabled
from pg_class where relname in ('daybook_entries','daybook_preferences','daybook_planner_items');

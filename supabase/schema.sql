create extension if not exists pgcrypto;
create table if not exists public.specimens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  specimen_code text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique(owner_id, specimen_code)
);
alter table public.specimens enable row level security;
create policy "owners read specimens" on public.specimens for select using (auth.uid()=owner_id);
create policy "owners insert specimens" on public.specimens for insert with check (auth.uid()=owner_id);
create policy "owners update specimens" on public.specimens for update using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "owners delete specimens" on public.specimens for delete using (auth.uid()=owner_id);
insert into storage.buckets (id,name,public) values ('collection-files','collection-files',false) on conflict (id) do nothing;
create policy "owners manage collection files" on storage.objects for all using (bucket_id='collection-files' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='collection-files' and (storage.foldername(name))[1]=auth.uid()::text);

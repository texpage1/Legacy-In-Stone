-- Legacy in Stone v0.6.2 cloud attachments and permissions

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.specimens to authenticated;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  specimen_code text,
  material_type text not null,
  file_name text not null,
  mime_type text,
  storage_path text not null unique,
  caption text,
  source_path text,
  created_at timestamptz not null default now()
);

alter table public.attachments enable row level security;
drop policy if exists "owners read attachments" on public.attachments;
drop policy if exists "owners insert attachments" on public.attachments;
drop policy if exists "owners update attachments" on public.attachments;
drop policy if exists "owners delete attachments" on public.attachments;
create policy "owners read attachments" on public.attachments for select using (auth.uid()=owner_id);
create policy "owners insert attachments" on public.attachments for insert with check (auth.uid()=owner_id);
create policy "owners update attachments" on public.attachments for update using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "owners delete attachments" on public.attachments for delete using (auth.uid()=owner_id);
grant select, insert, update, delete on table public.attachments to authenticated;

insert into storage.buckets (id,name,public) values ('collection-files','collection-files',false) on conflict (id) do update set public=false;
drop policy if exists "owners manage collection files" on storage.objects;
create policy "owners manage collection files" on storage.objects for all
using (bucket_id='collection-files' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='collection-files' and (storage.foldername(name))[1]=auth.uid()::text);

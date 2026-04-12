begin;

-- =========================================================
-- 1. Enum de tipo de tarefa de cobrança
-- =========================================================
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'collection_task_type'
      and n.nspname = 'public'
  ) then
    create type public.collection_task_type as enum (
      'pre_due_reminder',
      'due_today_reminder',
      'post_due_followup',
      'manual_call'
    );
  end if;
end $$;

-- =========================================================
-- 2. Enum de status da tarefa de cobrança
-- =========================================================
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'collection_task_status'
      and n.nspname = 'public'
  ) then
    create type public.collection_task_status as enum (
      'pending',
      'completed',
      'dismissed'
    );
  end if;
end $$;

-- =========================================================
-- 3. Regras de cobrança da clínica
-- =========================================================
create table if not exists public.collection_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  title text not null,
  description text,
  task_type public.collection_task_type not null,
  days_offset integer not null,
  is_active boolean not null default true,
  requires_manual_check boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.collection_rules is
'Regras configuráveis de geração de tarefas de cobrança baseadas em vencimento.';

comment on column public.collection_rules.rule_code is
'Código técnico estável da regra. Ex.: pre_due_3d, due_today, post_due_2d, manual_call_7d.';

comment on column public.collection_rules.days_offset is
'Deslocamento em dias em relação ao vencimento da parcela. Negativo = antes, zero = no dia, positivo = após o vencimento.';

comment on column public.collection_rules.requires_manual_check is
'Indica se a conclusão da tarefa depende de confirmação manual da equipe.';

-- =========================================================
-- 4. Tarefas geradas de cobrança
-- =========================================================
create table if not exists public.collection_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_id uuid references public.treatments(id) on delete set null,
  installment_id uuid references public.installments(id) on delete cascade,
  rule_id uuid references public.collection_rules(id) on delete set null,
  task_type public.collection_task_type not null,
  status public.collection_task_status not null default 'pending',
  title text not null,
  description text,
  due_date date not null,
  scheduled_for date not null,
  amount numeric(12,2),
  days_offset integer,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  dismissed_at timestamptz,
  dismissed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.collection_tasks is
'Tarefas operacionais de cobrança geradas para pacientes/parcela, com rastreabilidade de execução.';

comment on column public.collection_tasks.scheduled_for is
'Data em que a ação deve aparecer para acompanhamento da equipe.';

comment on column public.collection_tasks.completed_by is
'Usuário que marcou a tarefa como concluída.';

comment on column public.collection_tasks.dismissed_by is
'Usuário que dispensou ou removeu a tarefa da fila operacional.';

-- =========================================================
-- 5. Índices
-- =========================================================
create index if not exists idx_collection_rules_active
  on public.collection_rules (is_active);

create index if not exists idx_collection_tasks_status
  on public.collection_tasks (status);

create index if not exists idx_collection_tasks_scheduled_for
  on public.collection_tasks (scheduled_for);

create index if not exists idx_collection_tasks_patient_id
  on public.collection_tasks (patient_id);

create index if not exists idx_collection_tasks_installment_id
  on public.collection_tasks (installment_id);

create index if not exists idx_collection_tasks_treatment_id
  on public.collection_tasks (treatment_id);

create index if not exists idx_collection_tasks_status_scheduled_for
  on public.collection_tasks (status, scheduled_for);

-- =========================================================
-- 6. Trigger de updated_at
-- =========================================================
create or replace function public.set_collection_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$function$;

drop trigger if exists trg_collection_rules_updated_at on public.collection_rules;
create trigger trg_collection_rules_updated_at
before update on public.collection_rules
for each row
execute function public.set_collection_updated_at();

drop trigger if exists trg_collection_tasks_updated_at on public.collection_tasks;
create trigger trg_collection_tasks_updated_at
before update on public.collection_tasks
for each row
execute function public.set_collection_updated_at();

-- =========================================================
-- 7. Seed inicial das regras padrão
-- =========================================================
insert into public.collection_rules (
  rule_code,
  title,
  description,
  task_type,
  days_offset,
  is_active,
  requires_manual_check
)
values
  (
    'pre_due_primary',
    'Lembrete principal antes do vencimento',
    'Lembrete operacional principal antes do vencimento da parcela.',
    'pre_due_reminder',
    -3,
    true,
    true
  ),
  (
    'pre_due_secondary',
    'Lembrete secundário antes do vencimento',
    'Lembrete operacional secundário antes do vencimento da parcela.',
    'pre_due_reminder',
    -1,
    true,
    true
  ),
  (
    'due_day',
    'Lembrete no dia do vencimento',
    'Lembrete operacional no próprio dia do vencimento.',
    'due_today_reminder',
    0,
    true,
    true
  ),
  (
    'post_due_primary',
    'Acompanhamento principal após vencimento',
    'Tarefa principal de acompanhamento para parcelas inadimplentes após o vencimento.',
    'post_due_followup',
    2,
    true,
    true
  ),
  (
    'manual_call_primary',
    'Ligação principal após vencimento',
    'Tarefa manual de ligação quando a parcela continuar inadimplente.',
    'manual_call',
    7,
    true,
    true
  )
on conflict (rule_code) do nothing;

-- =========================================================
-- 8. RLS básica compatível com o estado atual do projeto
-- =========================================================
alter table public.collection_rules enable row level security;
alter table public.collection_tasks enable row level security;

drop policy if exists "Allow authenticated access to collection_rules" on public.collection_rules;
create policy "Allow authenticated access to collection_rules"
on public.collection_rules
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated access to collection_tasks" on public.collection_tasks;
create policy "Allow authenticated access to collection_tasks"
on public.collection_tasks
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

commit;
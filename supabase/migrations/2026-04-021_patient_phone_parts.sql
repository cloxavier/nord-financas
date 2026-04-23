-- Adiciona estrutura de telefone em país + DDD + número, preservando compatibilidade
-- com o campo legado phone já existente.

alter table public.patients
  add column if not exists phone_country_code text,
  add column if not exists phone_area_code text,
  add column if not exists phone_number text;

-- Backfill conservador dos telefones já existentes.
-- Regra:
-- 1) Se vier 10 ou 11 dígitos, assume Brasil (+55), DDD = 2 primeiros dígitos
-- 2) Se vier com 55 + DDD + número (12 ou 13 dígitos), separa normalmente
-- 3) Se não encaixar, mantém no campo legado e joga o restante em phone_number quando vazio
update public.patients
set
  phone_country_code = case
    when coalesce(regexp_replace(phone, '\\D', '', 'g'), '') = '' then phone_country_code
    when regexp_replace(phone, '\\D', '', 'g') ~ '^55\\d{10,11}$' then '55'
    when regexp_replace(phone, '\\D', '', 'g') ~ '^\\d{10,11}$' then '55'
    else phone_country_code
  end,
  phone_area_code = case
    when coalesce(regexp_replace(phone, '\\D', '', 'g'), '') = '' then phone_area_code
    when regexp_replace(phone, '\\D', '', 'g') ~ '^55\\d{10,11}$'
      then substr(regexp_replace(phone, '\\D', '', 'g'), 3, 2)
    when regexp_replace(phone, '\\D', '', 'g') ~ '^\\d{10,11}$'
      then substr(regexp_replace(phone, '\\D', '', 'g'), 1, 2)
    else phone_area_code
  end,
  phone_number = case
    when coalesce(regexp_replace(phone, '\\D', '', 'g'), '') = '' then phone_number
    when regexp_replace(phone, '\\D', '', 'g') ~ '^55\\d{10,11}$'
      then substr(regexp_replace(phone, '\\D', '', 'g'), 5)
    when regexp_replace(phone, '\\D', '', 'g') ~ '^\\d{10,11}$'
      then substr(regexp_replace(phone, '\\D', '', 'g'), 3)
    when coalesce(phone_number, '') = ''
      then regexp_replace(phone, '\\D', '', 'g')
    else phone_number
  end
where coalesce(phone, '') <> ''
  and (
    coalesce(phone_country_code, '') = ''
    or coalesce(phone_area_code, '') = ''
    or coalesce(phone_number, '') = ''
  );

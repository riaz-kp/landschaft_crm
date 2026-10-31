-- Landschaft CRM — saving only the fields that changed.
--
-- The app used to send a whole record with every save. When two people had the
-- same record open, or one of them was offline for a while, the later save put
-- back everything the other had changed in the meantime. save_records() takes
-- just the fields each person changed and lays them on the copy the database
-- holds at that moment, in one statement, so a change made in between stays.
--
-- It never brings back a record someone else deleted: a change to a record
-- that is no longer there is answered "gone" instead of re-creating it.
--
-- security invoker: it runs as the caller, so the row-level security and the
-- guards from the init migration apply exactly as they do to a direct write.
--
-- p_records: [{ "id": text, "set": {field: value}, "unset": [field], "create": bool }]
--   set     the fields this person changed, with their new values
--   unset   fields this person removed
--   create  a record they made: "set" holds all of it, inserted if the id is new
-- Returns [{ "id", "status": "saved" | "gone", "data": the record as now stored }].

create function public.save_records(p_table text, p_records jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rec jsonb;
  rec_id text;
  stored jsonb;
  visible boolean;
  results jsonb := '[]'::jsonb;
begin
  -- Only the collection tables: an id and the record as JSON.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'data' and data_type = 'jsonb'
  ) then
    raise exception 'Unknown collection: %', p_table using errcode = '22023';
  end if;

  for rec in select value from jsonb_array_elements(p_records) loop
    rec_id := rec ->> 'id';
    -- One statement, so it merges onto whatever the row holds as it is written.
    execute format('update public.%I set data = (data - $2) || $3 where id = $1 returning data', p_table)
      into stored
      using rec_id,
        array(select jsonb_array_elements_text(coalesce(rec -> 'unset', '[]'::jsonb))),
        coalesce(rec -> 'set', '{}'::jsonb);

    if stored is null then
      execute format('select exists (select 1 from public.%I where id = $1)', p_table) into visible using rec_id;
      if visible then
        -- The record is there and readable, but this person may not change it.
        raise exception 'You do not have permission to make that change.' using errcode = '42501';
      elsif coalesce((rec ->> 'create')::boolean, false) then
        execute format('insert into public.%I (id, data) values ($1, $2) returning data', p_table)
          into stored using rec_id, rec -> 'set';
      end if;
    end if;

    results := results || jsonb_build_array(jsonb_build_object(
      'id', rec_id,
      'status', case when stored is null then 'gone' else 'saved' end,
      'data', stored
    ));
  end loop;
  return results;
end;
$$;

revoke all on function public.save_records(text, jsonb) from public, anon;
grant execute on function public.save_records(text, jsonb) to authenticated;

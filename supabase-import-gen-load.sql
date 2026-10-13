-- Generator peak loads, week of Oct 2 to Oct 8, 2026 (% of rated capacity, by shift).
-- Run in Supabase: SQL Editor, New query, paste, Run. Safe to run twice (no duplicates).
insert into public.records (collection, id, data) values
('genLoad','gl-2026-10-02','{"date":"2026-10-02","g1d":37,"g1n":36,"g2d":37,"g2n":37,"g3d":34,"g3n":39}'),
('genLoad','gl-2026-10-03','{"date":"2026-10-03","g1d":65,"g1n":35,"g2d":53,"g2n":40,"g3d":43,"g3n":39}'),
('genLoad','gl-2026-10-04','{"date":"2026-10-04","g1d":50,"g1n":49,"g2d":39,"g2n":40,"g3d":40,"g3n":45}'),
('genLoad','gl-2026-10-05','{"date":"2026-10-05","g1d":59,"g1n":40,"g2d":44,"g2n":34,"g3d":37,"g3n":37}'),
('genLoad','gl-2026-10-06','{"date":"2026-10-06","g1d":47,"g1n":34,"g2d":43,"g2n":41,"g3d":42,"g3n":49}'),
('genLoad','gl-2026-10-07','{"date":"2026-10-07","g1d":50,"g1n":31,"g2d":50,"g2n":32,"g3d":43,"g3n":38}'),
('genLoad','gl-2026-10-08','{"date":"2026-10-08","g1d":45,"g1n":47,"g2d":53,"g2n":49,"g3d":41,"g3n":39}')
on conflict (collection, id) do update set data = excluded.data;
select count(*) as gen_load_days from public.records where collection = 'genLoad';

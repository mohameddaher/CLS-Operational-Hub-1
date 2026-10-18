-- Airport gate clearance: five more staff (issue date left empty, add it with Edit in the app).
-- Run in Supabase: SQL Editor, New query, paste, Run. Safe to run twice (no duplicates).
insert into public.records (collection, id, data) values
('clearances','cl-st-amina',$cls${"holder":"Amina Amin","office":"AMISOM office","type":"Staff"}$cls$::jsonb),
('clearances','cl-st-badiso',$cls${"holder":"Badiso Ismacil Abdirahman","office":"AMISOM office","type":"Staff"}$cls$::jsonb),
('clearances','cl-st-mohamed-roble',$cls${"holder":"Mohamed Abdullahi Ahmed Roble","office":"AMISOM office","type":"Staff"}$cls$::jsonb),
('clearances','cl-st-abdulghani',$cls${"holder":"Abdulghani Saeed","office":"AMISOM office","type":"Staff"}$cls$::jsonb),
('clearances','cl-st-fuad',$cls${"holder":"Fuad Moghe","office":"AMISOM office","type":"Staff"}$cls$::jsonb)
on conflict (collection, id) do nothing;
select count(*) as clearance_records from public.records where collection = 'clearances';

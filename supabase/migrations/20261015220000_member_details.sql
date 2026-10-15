-- VanshVriksh: extra member details.
alter table persons add column if not exists nickname text;
alter table persons add column if not exists birth_place text;
alter table persons add column if not exists current_location text;

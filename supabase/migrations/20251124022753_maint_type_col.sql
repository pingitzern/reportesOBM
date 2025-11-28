alter table public.maintenances
	add column if not exists type text not null default 'ro',
	add constraint maintenances_type_chk
		check (type in ('ro', 'softener'));

-- Horário-limite para um atendimento terminar. Com ele, o expediente define os horários de início
-- (ex.: tarde das 13:00 às 18:30 → último início 18:00) e o atendimento pode passar do fim do período,
-- desde que termine até este horário. Nulo = regra antiga (precisa terminar dentro do período).
alter table public.businesses add column latest_end_time time default '20:30';

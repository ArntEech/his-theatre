-- =============================================================================
-- His Theatre: the current period, set up the same way as HIS Finance.
-- Run this ONCE, after 0001_his_theatre.sql, in Supabase → SQL Editor.
--
--   * 9 weeks, Monday 9 Nov 2026 to the week of 4 Jan 2027, all counting for dues.
--     (Free weeks such as Interim Assessment are switched off later in the app:
--      Admin → Semester, by the Director.)
--   * Executives GH₵10 a week, members GH₵5 a week.
-- Members and payments are added by the import file made from the HIS Finance sheet.
-- =============================================================================

insert into public.semesters (name, starts_on, ends_on)
values ('2026/27 Sem 1', '2026-11-09', '2027-01-10');

insert into public.semester_weeks (semester_id, week_no, week_start, counts)
select s.id, g, date '2026-11-09' + (g - 1) * 7, true
from public.semesters s, generate_series(1, 9) g
where s.name = '2026/27 Sem 1';

insert into public.dues_rates (semester_id, category, weekly_amount)
select s.id, c.category::public.member_category, c.amount
from public.semesters s,
     (values ('executive', 1000), ('member', 500)) as c(category, amount)
where s.name = '2026/27 Sem 1';

-- Check: should show 9 weeks and 2 rates.
select (select count(*) from public.semester_weeks) as weeks, (select count(*) from public.dues_rates) as rates;

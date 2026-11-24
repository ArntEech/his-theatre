-- His Theatre: live updates. Changes to these tables are sent to signed-in phones so their
-- screens refresh by themselves. Supabase checks each table's read rules per person, so a
-- member only hears about their own records.
alter publication supabase_realtime add table
  public.payments, public.adjustments, public.expenses, public.other_income, public.handovers,
  public.members, public.member_semesters, public.semester_weeks, public.dues_rates, public.semesters;

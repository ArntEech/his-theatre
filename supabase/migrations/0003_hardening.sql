-- His Theatre: small hardening from Supabase's security check (21 Nov 2026).
-- These helper functions only use built-in functions and fully named objects, so pinning
-- their search path changes nothing in how they work; it just stops anyone from swapping
-- in look-alike objects.
alter function private.from_app()          set search_path = '';
alter function private.trusted()           set search_path = '';
alter function private.block_changes()     set search_path = '';
alter function private.cedi(int)           set search_path = '';
alter function private.is_weak_pin(text)   set search_path = '';

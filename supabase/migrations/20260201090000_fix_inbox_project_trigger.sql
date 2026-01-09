-- Fix Inbox project trigger to align with current projects schema (title/source_items)

DROP FUNCTION IF EXISTS public.create_inbox_project();

CREATE OR REPLACE FUNCTION public.create_inbox_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.projects (user_id, title, status, source_items)
    VALUES (NEW.id, 'Inbox', 'draft', '[]'::jsonb);
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
    ) THEN
        EXECUTE 'DROP TRIGGER IF EXISTS create_inbox_on_profile_insert ON public.profiles';
        EXECUTE 'CREATE TRIGGER create_inbox_on_profile_insert '
            || 'AFTER INSERT ON public.profiles '
            || 'FOR EACH ROW '
            || 'EXECUTE FUNCTION public.create_inbox_project()';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inbox_project() FROM PUBLIC;

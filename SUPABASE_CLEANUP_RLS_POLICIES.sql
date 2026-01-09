-- ============================================
-- MVP 1.0 RLS Policies Cleanup Script
-- ============================================
-- This script removes non-canonical RLS policies from MVP 1.0 tables.
-- Expected: 20 policies (4 per table)
-- Removes: Extra policies that don't match the canonical naming pattern
-- ============================================

-- ============================================
-- STEP 1: List ALL current policies (for reference)
-- ============================================
SELECT 
    'Current Policies' AS info,
    schemaname,
    tablename,
    policyname,
    cmd AS operation
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
ORDER BY tablename, policyname;

-- ============================================
-- STEP 2: Define canonical policy names
-- ============================================
-- Canonical policies per table (4 each):
-- projects: 
--   - "Users can select own projects"
--   - "Users can insert own projects"
--   - "Users can update own projects"
--   - "Users can delete own projects"
-- monthly_focus:
--   - "Users can select own monthly_focus"
--   - "Users can insert own monthly_focus"
--   - "Users can update own monthly_focus"
--   - "Users can delete own monthly_focus"
-- weekly_tasks:
--   - "Users can select own weekly_tasks"
--   - "Users can insert own weekly_tasks"
--   - "Users can update own weekly_tasks"
--   - "Users can delete own weekly_tasks"
-- routines:
--   - "Users can select own routines"
--   - "Users can insert own routines"
--   - "Users can update own routines"
--   - "Users can delete own routines"
-- routine_completions:
--   - "Users can select own routine_completions"
--   - "Users can insert own routine_completions"
--   - "Users can update own routine_completions"
--   - "Users can delete own routine_completions"

-- ============================================
-- STEP 3: Drop non-canonical policies
-- ============================================
-- This will drop all policies that don't match the canonical pattern
-- and then recreate the canonical ones if they don't exist

DO $$
DECLARE
    policy_record RECORD;
    canonical_policies TEXT[] := ARRAY[
        'Users can select own projects',
        'Users can insert own projects',
        'Users can update own projects',
        'Users can delete own projects',
        'Users can select own monthly_focus',
        'Users can insert own monthly_focus',
        'Users can update own monthly_focus',
        'Users can delete own monthly_focus',
        'Users can select own weekly_tasks',
        'Users can insert own weekly_tasks',
        'Users can update own weekly_tasks',
        'Users can delete own weekly_tasks',
        'Users can select own routines',
        'Users can insert own routines',
        'Users can update own routines',
        'Users can delete own routines',
        'Users can select own routine_completions',
        'Users can insert own routine_completions',
        'Users can update own routine_completions',
        'Users can delete own routine_completions'
    ];
BEGIN
    -- Drop all policies that are not in the canonical list
    FOR policy_record IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
            AND policyname != ALL(canonical_policies)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            policy_record.policyname, 
            policy_record.schemaname, 
            policy_record.tablename);
        RAISE NOTICE 'Dropped non-canonical policy: %.% on %.%', 
            policy_record.schemaname, 
            policy_record.policyname, 
            policy_record.schemaname, 
            policy_record.tablename;
    END LOOP;
END $$;

-- ============================================
-- STEP 4: Recreate canonical policies if missing
-- ============================================

-- Projects policies
DROP POLICY IF EXISTS "Users can select own projects" ON public.projects;
CREATE POLICY "Users can select own projects"
    ON public.projects FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
    ON public.projects FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- Monthly Focus policies
DROP POLICY IF EXISTS "Users can select own monthly_focus" ON public.monthly_focus;
CREATE POLICY "Users can select own monthly_focus"
    ON public.monthly_focus FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own monthly_focus" ON public.monthly_focus;
CREATE POLICY "Users can insert own monthly_focus"
    ON public.monthly_focus FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own monthly_focus" ON public.monthly_focus;
CREATE POLICY "Users can update own monthly_focus"
    ON public.monthly_focus FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own monthly_focus" ON public.monthly_focus;
CREATE POLICY "Users can delete own monthly_focus"
    ON public.monthly_focus FOR DELETE
    USING (auth.uid() = user_id);

-- Weekly Tasks policies
DROP POLICY IF EXISTS "Users can select own weekly_tasks" ON public.weekly_tasks;
CREATE POLICY "Users can select own weekly_tasks"
    ON public.weekly_tasks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own weekly_tasks" ON public.weekly_tasks;
CREATE POLICY "Users can insert own weekly_tasks"
    ON public.weekly_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own weekly_tasks" ON public.weekly_tasks;
CREATE POLICY "Users can update own weekly_tasks"
    ON public.weekly_tasks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own weekly_tasks" ON public.weekly_tasks;
CREATE POLICY "Users can delete own weekly_tasks"
    ON public.weekly_tasks FOR DELETE
    USING (auth.uid() = user_id);

-- Routines policies
DROP POLICY IF EXISTS "Users can select own routines" ON public.routines;
CREATE POLICY "Users can select own routines"
    ON public.routines FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own routines" ON public.routines;
CREATE POLICY "Users can insert own routines"
    ON public.routines FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own routines" ON public.routines;
CREATE POLICY "Users can update own routines"
    ON public.routines FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own routines" ON public.routines;
CREATE POLICY "Users can delete own routines"
    ON public.routines FOR DELETE
    USING (auth.uid() = user_id);

-- Routine Completions policies
DROP POLICY IF EXISTS "Users can select own routine_completions" ON public.routine_completions;
CREATE POLICY "Users can select own routine_completions"
    ON public.routine_completions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own routine_completions" ON public.routine_completions;
CREATE POLICY "Users can insert own routine_completions"
    ON public.routine_completions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own routine_completions" ON public.routine_completions;
CREATE POLICY "Users can update own routine_completions"
    ON public.routine_completions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own routine_completions" ON public.routine_completions;
CREATE POLICY "Users can delete own routine_completions"
    ON public.routine_completions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Verification
-- ============================================
-- Show final policy count
SELECT 
    'Verification' AS check_type,
    'Total Policies' AS item,
    COUNT(*)::text AS count,
    CASE 
        WHEN COUNT(*) = 20 THEN '✓ PASS (Expected: 20)' 
        ELSE '✗ FAIL (Expected: 20, Actual: ' || COUNT(*) || ')' 
    END AS status
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions');

-- Show policies count by table
SELECT 
    'Verification' AS check_type,
    'Policies by Table' AS item,
    tablename || ': ' || COUNT(*)::text AS count,
    CASE 
        WHEN COUNT(*) = 4 THEN '✓ PASS' 
        ELSE '✗ FAIL (Expected: 4)' 
    END AS status
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
GROUP BY tablename
ORDER BY tablename;

-- List all remaining policies
SELECT 
    'Final Policy List' AS info,
    tablename,
    policyname,
    cmd AS operation
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
ORDER BY tablename, policyname;

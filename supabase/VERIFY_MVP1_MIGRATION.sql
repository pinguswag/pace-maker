-- ============================================
-- MVP 1.0 Domain Tables Migration - Verification Script
-- ============================================
-- Run this after applying the migration to verify everything is correct.
-- ============================================

-- 1. Check if tables exist
SELECT 
    'Tables Check' AS check_type,
    table_name,
    CASE 
        WHEN table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions') 
        THEN '✓ EXISTS' 
        ELSE '✗ MISSING' 
    END AS status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
ORDER BY table_name;

-- 2. Check RLS is enabled
SELECT 
    'RLS Check' AS check_type,
    c.relname AS table_name,
    CASE 
        WHEN c.relrowsecurity THEN '✓ ENABLED' 
        ELSE '✗ DISABLED' 
    END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
    AND c.relname IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
    AND c.relkind = 'r'  -- Only regular tables
ORDER BY c.relname;

-- 3. Check RLS policies exist (should be 4 per table: SELECT, INSERT, UPDATE, DELETE)
SELECT 
    'RLS Policies Check' AS check_type,
    tablename AS table_name,
    COUNT(*) AS policy_count,
    CASE 
        WHEN COUNT(*) = 4 THEN '✓ COMPLETE (4 policies)' 
        ELSE '✗ INCOMPLETE (' || COUNT(*) || ' policies)' 
    END AS status
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
GROUP BY tablename
ORDER BY tablename;

-- 4. Check triggers exist (should be 1 per table: set_*_updated_at)
SELECT 
    'Triggers Check' AS check_type,
    event_object_table AS table_name,
    COUNT(*) AS trigger_count,
    CASE 
        WHEN COUNT(*) >= 1 THEN '✓ EXISTS' 
        ELSE '✗ MISSING' 
    END AS status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
    AND trigger_name LIKE 'set_%_updated_at'
GROUP BY event_object_table
ORDER BY event_object_table;

-- 5. Check trigger function exists
SELECT 
    'Function Check' AS check_type,
    routine_name AS function_name,
    CASE 
        WHEN routine_name = 'set_updated_at' THEN '✓ EXISTS' 
        ELSE '✗ MISSING' 
    END AS status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name = 'set_updated_at';

-- 6. Check UNIQUE constraints
SELECT 
    'UNIQUE Constraints Check' AS check_type,
    tc.table_name,
    tc.constraint_name,
    '✓ EXISTS' AS status
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'UNIQUE'
    AND tc.table_name IN ('monthly_focus', 'routine_completions')
ORDER BY tc.table_name, tc.constraint_name;

-- 7. Check CHECK constraints
SELECT 
    'CHECK Constraints Check' AS check_type,
    tc.table_name,
    tc.constraint_name,
    '✓ EXISTS' AS status
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'CHECK'
    AND tc.table_name = 'monthly_focus'
ORDER BY tc.table_name, tc.constraint_name;

-- 8. Check Foreign Key constraints and ON DELETE behavior
SELECT 
    'Foreign Keys Check' AS check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    rc.delete_rule AS on_delete_behavior,
    CASE 
        WHEN rc.delete_rule IN ('CASCADE', 'SET NULL') THEN '✓ CORRECT' 
        ELSE '⚠ CHECK: ' || rc.delete_rule 
    END AS status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
ORDER BY tc.table_name, kcu.column_name;

-- 9. Check indexes exist
SELECT 
    'Indexes Check' AS check_type,
    tablename AS table_name,
    indexname AS index_name,
    '✓ EXISTS' AS status
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
    AND indexname NOT LIKE '%_pkey'  -- Exclude primary key indexes
ORDER BY tablename, indexname;

-- 10. Summary: Expected counts
SELECT 
    'Summary' AS check_type,
    'Expected Tables: 5' AS expected,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')) AS actual,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')) = 5 
        THEN '✓ MATCH' 
        ELSE '✗ MISMATCH' 
    END AS status
UNION ALL
SELECT 
    'Summary' AS check_type,
    'Expected Policies: 20 (4 per table)' AS expected,
    (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')) AS actual,
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')) = 20 
        THEN '✓ MATCH' 
        ELSE '✗ MISMATCH' 
    END AS status
UNION ALL
SELECT 
    'Summary' AS check_type,
    'Expected Triggers: 5 (1 per table)' AS expected,
    (SELECT COUNT(*)::text FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions') AND trigger_name LIKE 'set_%_updated_at') AS actual,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions') AND trigger_name LIKE 'set_%_updated_at') = 5 
        THEN '✓ MATCH' 
        ELSE '✗ MISMATCH' 
    END AS status;

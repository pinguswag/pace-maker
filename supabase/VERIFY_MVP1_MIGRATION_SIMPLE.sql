-- ============================================
-- MVP 1.0 Domain Tables Migration - Simple Verification
-- ============================================
-- Run each query separately if you encounter errors
-- ============================================

-- Query 1: Check if tables exist
SELECT 
    'Tables Check' AS check_type,
    table_name,
    '✓ EXISTS' AS status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
ORDER BY table_name;

-- Query 2: Check RLS is enabled (using pg_class)
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
    AND c.relkind = 'r'
ORDER BY c.relname;

-- Query 3: Check RLS policies count
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

-- Query 4: Check triggers
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

-- Query 5: Check function
SELECT 
    'Function Check' AS check_type,
    routine_name AS function_name,
    '✓ EXISTS' AS status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name = 'set_updated_at';

-- Query 6: Check UNIQUE constraints
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

-- Query 7: Check CHECK constraints
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

-- Query 8: Check Foreign Keys
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

-- Query 9: Check indexes
SELECT 
    'Indexes Check' AS check_type,
    tablename AS table_name,
    indexname AS index_name,
    '✓ EXISTS' AS status
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
    AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- Query 10: Summary
SELECT 
    'Summary' AS check_type,
    'Expected Tables: 5' AS expected,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions'))::text AS actual,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')) = 5 
        THEN '✓ MATCH' 
        ELSE '✗ MISMATCH' 
    END AS status
UNION ALL
SELECT 
    'Summary' AS check_type,
    'Expected Policies: 20' AS expected,
    (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')) AS actual,
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')) = 20 
        THEN '✓ MATCH' 
        ELSE '✗ MISMATCH' 
    END AS status
UNION ALL
SELECT 
    'Summary' AS check_type,
    'Expected Triggers: 5' AS expected,
    (SELECT COUNT(*)::text FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions') AND trigger_name LIKE 'set_%_updated_at') AS actual,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions') AND trigger_name LIKE 'set_%_updated_at') = 5 
        THEN '✓ MATCH' 
        ELSE '✗ MISMATCH' 
    END AS status;

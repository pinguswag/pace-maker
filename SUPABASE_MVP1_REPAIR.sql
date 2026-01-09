-- ============================================
-- MVP 1.0 Schema Repair Script
-- ============================================
-- This script repairs a partially applied Supabase schema to the complete MVP 1.0 state.
-- Safe to run multiple times (idempotent).
-- 
-- NOTE: Does NOT modify existing Mandarat tables:
-- - mandarat_boards
-- - mandarat_strategies
-- - mandarat_actions
-- ============================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 2. FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. TABLES AND COLUMNS
-- ============================================

-- 3.1 Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    source_items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns if table exists but columns are missing
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
-- Set PRIMARY KEY if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.projects'::regclass 
        AND contype = 'p'
    ) THEN
        ALTER TABLE public.projects ADD PRIMARY KEY (id);
    END IF;
END $$;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS source_items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Set NOT NULL constraints if columns exist but are nullable
DO $$
BEGIN
    -- Add FK constraint if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'projects' 
        AND kcu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.projects ADD CONSTRAINT projects_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
        ALTER TABLE public.projects ALTER COLUMN user_id SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'title' AND is_nullable = 'YES') THEN
        ALTER TABLE public.projects ALTER COLUMN title SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'status' AND is_nullable = 'YES') THEN
        ALTER TABLE public.projects ALTER COLUMN status SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'source_items' AND is_nullable = 'YES') THEN
        ALTER TABLE public.projects ALTER COLUMN source_items SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'created_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.projects ALTER COLUMN created_at SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'updated_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.projects ALTER COLUMN updated_at SET NOT NULL;
    END IF;
END $$;

-- 3.2 Monthly Focus Table
CREATE TABLE IF NOT EXISTS public.monthly_focus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_key text NOT NULL,
    project_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monthly_focus ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.monthly_focus'::regclass 
        AND contype = 'p'
    ) THEN
        ALTER TABLE public.monthly_focus ADD PRIMARY KEY (id);
    END IF;
END $$;

ALTER TABLE public.monthly_focus ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.monthly_focus ADD COLUMN IF NOT EXISTS month_key text;
ALTER TABLE public.monthly_focus ADD COLUMN IF NOT EXISTS project_ids uuid[] DEFAULT '{}'::uuid[];
ALTER TABLE public.monthly_focus ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.monthly_focus ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'monthly_focus' 
        AND kcu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.monthly_focus ADD CONSTRAINT monthly_focus_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monthly_focus' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
        ALTER TABLE public.monthly_focus ALTER COLUMN user_id SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monthly_focus' AND column_name = 'month_key' AND is_nullable = 'YES') THEN
        ALTER TABLE public.monthly_focus ALTER COLUMN month_key SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monthly_focus' AND column_name = 'project_ids' AND is_nullable = 'YES') THEN
        ALTER TABLE public.monthly_focus ALTER COLUMN project_ids SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monthly_focus' AND column_name = 'created_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.monthly_focus ALTER COLUMN created_at SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monthly_focus' AND column_name = 'updated_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.monthly_focus ALTER COLUMN updated_at SET NOT NULL;
    END IF;
END $$;

-- 3.3 Weekly Tasks Table
CREATE TABLE IF NOT EXISTS public.weekly_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_key text NOT NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'todo',
    order_index int NOT NULL DEFAULT 0,
    picked_for_today boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.weekly_tasks'::regclass 
        AND contype = 'p'
    ) THEN
        ALTER TABLE public.weekly_tasks ADD PRIMARY KEY (id);
    END IF;
END $$;

ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS week_key text;
ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS status text DEFAULT 'todo';
ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS order_index int DEFAULT 0;
ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS picked_for_today boolean DEFAULT false;
ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.weekly_tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'weekly_tasks' 
        AND kcu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.weekly_tasks ADD CONSTRAINT weekly_tasks_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'weekly_tasks' 
        AND kcu.column_name = 'project_id' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.weekly_tasks ADD CONSTRAINT weekly_tasks_project_id_fkey 
            FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_tasks' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
        ALTER TABLE public.weekly_tasks ALTER COLUMN user_id SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_tasks' AND column_name = 'week_key' AND is_nullable = 'YES') THEN
        ALTER TABLE public.weekly_tasks ALTER COLUMN week_key SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_tasks' AND column_name = 'title' AND is_nullable = 'YES') THEN
        ALTER TABLE public.weekly_tasks ALTER COLUMN title SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_tasks' AND column_name = 'status' AND is_nullable = 'YES') THEN
        ALTER TABLE public.weekly_tasks ALTER COLUMN status SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_tasks' AND column_name = 'order_index' AND is_nullable = 'YES') THEN
        ALTER TABLE public.weekly_tasks ALTER COLUMN order_index SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_tasks' AND column_name = 'picked_for_today' AND is_nullable = 'YES') THEN
        ALTER TABLE public.weekly_tasks ALTER COLUMN picked_for_today SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_tasks' AND column_name = 'created_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.weekly_tasks ALTER COLUMN created_at SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_tasks' AND column_name = 'updated_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.weekly_tasks ALTER COLUMN updated_at SET NOT NULL;
    END IF;
END $$;

-- 3.4 Routines Table
CREATE TABLE IF NOT EXISTS public.routines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    cadence text NOT NULL,
    days int[] NOT NULL DEFAULT '{}'::int[],
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.routines'::regclass 
        AND contype = 'p'
    ) THEN
        ALTER TABLE public.routines ADD PRIMARY KEY (id);
    END IF;
END $$;

ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS cadence text;
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS days int[] DEFAULT '{}'::int[];
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'routines' 
        AND kcu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.routines ADD CONSTRAINT routines_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routines ALTER COLUMN user_id SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'title' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routines ALTER COLUMN title SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'cadence' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routines ALTER COLUMN cadence SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'days' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routines ALTER COLUMN days SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'is_active' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routines ALTER COLUMN is_active SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'created_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routines ALTER COLUMN created_at SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'updated_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routines ALTER COLUMN updated_at SET NOT NULL;
    END IF;
END $$;

-- 3.5 Routine Completions Table
CREATE TABLE IF NOT EXISTS public.routine_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_key text NOT NULL,
    routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    is_done boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.routine_completions ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.routine_completions'::regclass 
        AND contype = 'p'
    ) THEN
        ALTER TABLE public.routine_completions ADD PRIMARY KEY (id);
    END IF;
END $$;

ALTER TABLE public.routine_completions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.routine_completions ADD COLUMN IF NOT EXISTS date_key text;
ALTER TABLE public.routine_completions ADD COLUMN IF NOT EXISTS routine_id uuid;
ALTER TABLE public.routine_completions ADD COLUMN IF NOT EXISTS is_done boolean DEFAULT true;
ALTER TABLE public.routine_completions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.routine_completions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'routine_completions' 
        AND kcu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.routine_completions ADD CONSTRAINT routine_completions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'routine_completions' 
        AND kcu.column_name = 'routine_id' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.routine_completions ADD CONSTRAINT routine_completions_routine_id_fkey 
            FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routine_completions' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routine_completions ALTER COLUMN user_id SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routine_completions' AND column_name = 'date_key' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routine_completions ALTER COLUMN date_key SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routine_completions' AND column_name = 'routine_id' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routine_completions ALTER COLUMN routine_id SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routine_completions' AND column_name = 'is_done' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routine_completions ALTER COLUMN is_done SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routine_completions' AND column_name = 'created_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routine_completions ALTER COLUMN created_at SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routine_completions' AND column_name = 'updated_at' AND is_nullable = 'YES') THEN
        ALTER TABLE public.routine_completions ALTER COLUMN updated_at SET NOT NULL;
    END IF;
END $$;

-- ============================================
-- 4. CONSTRAINTS
-- ============================================

-- 4.1 Monthly Focus: UNIQUE(user_id, month_key)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'monthly_focus_user_id_month_key_key'
        AND conrelid = 'public.monthly_focus'::regclass
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'monthly_focus'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%user_id%month_key%'
    ) THEN
        ALTER TABLE public.monthly_focus ADD CONSTRAINT monthly_focus_user_id_month_key_key UNIQUE (user_id, month_key);
    END IF;
END $$;

-- 4.2 Monthly Focus: CHECK array_length(project_ids) <= 3
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE 'monthly_focus_project_ids_check%'
        AND conrelid = 'public.monthly_focus'::regclass
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'monthly_focus'
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%project_ids%'
    ) THEN
        ALTER TABLE public.monthly_focus ADD CONSTRAINT monthly_focus_project_ids_check 
            CHECK (array_length(project_ids, 1) IS NULL OR array_length(project_ids, 1) <= 3);
    END IF;
END $$;

-- 4.3 Routine Completions: UNIQUE(user_id, date_key, routine_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'routine_completions_user_id_date_key_routine_id_key'
        AND conrelid = 'public.routine_completions'::regclass
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'routine_completions'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%user_id%date_key%routine_id%'
    ) THEN
        ALTER TABLE public.routine_completions ADD CONSTRAINT routine_completions_user_id_date_key_routine_id_key 
            UNIQUE (user_id, date_key, routine_id);
    END IF;
END $$;

-- ============================================
-- 5. INDEXES
-- ============================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON public.projects(user_id, status);

-- Monthly Focus indexes
CREATE INDEX IF NOT EXISTS idx_monthly_focus_user_month ON public.monthly_focus(user_id, month_key);

-- Weekly Tasks indexes
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_user_week ON public.weekly_tasks(user_id, week_key);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_user_week_project ON public.weekly_tasks(user_id, week_key, project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_user_week_picked ON public.weekly_tasks(user_id, week_key, picked_for_today);

-- Routines indexes
CREATE INDEX IF NOT EXISTS idx_routines_user_active ON public.routines(user_id, is_active);

-- Routine Completions indexes
CREATE INDEX IF NOT EXISTS idx_routine_completions_user_date ON public.routine_completions(user_id, date_key);

-- ============================================
-- 6. TRIGGERS
-- ============================================

-- Projects trigger
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Monthly Focus trigger
DROP TRIGGER IF EXISTS set_monthly_focus_updated_at ON public.monthly_focus;
CREATE TRIGGER set_monthly_focus_updated_at
    BEFORE UPDATE ON public.monthly_focus
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Weekly Tasks trigger
DROP TRIGGER IF EXISTS set_weekly_tasks_updated_at ON public.weekly_tasks;
CREATE TRIGGER set_weekly_tasks_updated_at
    BEFORE UPDATE ON public.weekly_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Routines trigger
DROP TRIGGER IF EXISTS set_routines_updated_at ON public.routines;
CREATE TRIGGER set_routines_updated_at
    BEFORE UPDATE ON public.routines
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Routine Completions trigger
DROP TRIGGER IF EXISTS set_routine_completions_updated_at ON public.routine_completions;
CREATE TRIGGER set_routine_completions_updated_at
    BEFORE UPDATE ON public.routine_completions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS POLICIES
-- ============================================

-- 8.1 Projects policies
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

-- 8.2 Monthly Focus policies
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

-- 8.3 Weekly Tasks policies
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

-- 8.4 Routines policies
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

-- 8.5 Routine Completions policies
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
-- 9. VERIFICATION
-- ============================================
-- Run this section to verify the repair was successful

SELECT 
    'Verification' AS check_type,
    'Tables' AS item,
    COUNT(*)::text AS count,
    CASE WHEN COUNT(*) = 5 THEN '✓ PASS' ELSE '✗ FAIL (expected 5)' END AS status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
UNION ALL
SELECT 
    'Verification' AS check_type,
    'Policies' AS item,
    COUNT(*)::text AS count,
    CASE WHEN COUNT(*) = 20 THEN '✓ PASS' ELSE '✗ FAIL (expected 20)' END AS status
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
UNION ALL
SELECT 
    'Verification' AS check_type,
    'Triggers' AS item,
    COUNT(*)::text AS count,
    CASE WHEN COUNT(*) = 5 THEN '✓ PASS' ELSE '✗ FAIL (expected 5)' END AS status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table IN ('projects', 'monthly_focus', 'weekly_tasks', 'routines', 'routine_completions')
    AND trigger_name LIKE 'set_%_updated_at';

-- ============================================
-- Repair Script Complete
-- ============================================

-- ============================================
-- MVP 1.0 Domain Tables Migration
-- ============================================
-- This migration adds domain tables for MVP 1.0:
-- - projects
-- - monthly_focus
-- - weekly_tasks
-- - routines
-- - routine_completions
--
-- NOTE: This migration does NOT modify existing Mandarat tables:
-- - mandarat_boards
-- - mandarat_strategies
-- - mandarat_actions
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. Updated_at Trigger Function
-- ============================================
-- Create trigger function for automatic updated_at column updates
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Projects Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    source_items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON public.projects(user_id, status);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
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

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 3. Monthly Focus Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.monthly_focus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_key text NOT NULL,
    project_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, month_key),
    CHECK (array_length(project_ids, 1) IS NULL OR array_length(project_ids, 1) <= 3)
);

-- Index for monthly_focus
CREATE INDEX IF NOT EXISTS idx_monthly_focus_user_month ON public.monthly_focus(user_id, month_key);

-- Enable RLS
ALTER TABLE public.monthly_focus ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monthly_focus
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

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_monthly_focus_updated_at ON public.monthly_focus;
CREATE TRIGGER set_monthly_focus_updated_at
    BEFORE UPDATE ON public.monthly_focus
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 4. Weekly Tasks Table
-- ============================================
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

-- Indexes for weekly_tasks
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_user_week ON public.weekly_tasks(user_id, week_key);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_user_week_project ON public.weekly_tasks(user_id, week_key, project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_user_week_picked ON public.weekly_tasks(user_id, week_key, picked_for_today);

-- Enable RLS
ALTER TABLE public.weekly_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weekly_tasks
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

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_weekly_tasks_updated_at ON public.weekly_tasks;
CREATE TRIGGER set_weekly_tasks_updated_at
    BEFORE UPDATE ON public.weekly_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 5. Routines Table
-- ============================================
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

-- Index for routines
CREATE INDEX IF NOT EXISTS idx_routines_user_active ON public.routines(user_id, is_active);

-- Enable RLS
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for routines
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

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_routines_updated_at ON public.routines;
CREATE TRIGGER set_routines_updated_at
    BEFORE UPDATE ON public.routines
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 6. Routine Completions Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.routine_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_key text NOT NULL,
    routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    is_done boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, date_key, routine_id)
);

-- Indexes for routine_completions
CREATE INDEX IF NOT EXISTS idx_routine_completions_user_date ON public.routine_completions(user_id, date_key);

-- Enable RLS
ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for routine_completions
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

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_routine_completions_updated_at ON public.routine_completions;
CREATE TRIGGER set_routine_completions_updated_at
    BEFORE UPDATE ON public.routine_completions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- Migration Complete
-- ============================================

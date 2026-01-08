-- ============================================
-- 2026 Goal Planner - Supabase Database Schema
-- MVP Migration SQL
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Goal Structuring Tables
-- ============================================

-- 1.1 profiles
-- 사용자 프로필 및 만다라트 완료 상태 관리
CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    mandarat_completed boolean NOT NULL DEFAULT false
);

-- 1.2 mandarat
-- 만다라트 메인 (연간 목표)
CREATE TABLE mandarat (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    yearly_goal text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mandarat_user_id ON mandarat(user_id);

-- 1.3 strategy_axis
-- 8개 전략 축
CREATE TABLE strategy_axis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mandarat_id uuid NOT NULL REFERENCES mandarat(id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 1 AND position <= 8),
    title text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (mandarat_id, position)
);

CREATE INDEX idx_strategy_axis_mandarat_id ON strategy_axis(mandarat_id);

-- 1.4 action_ideas
-- 64개 실행 아이디어 (Project/Task/Routine의 Source)
CREATE TABLE action_ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_axis_id uuid NOT NULL REFERENCES strategy_axis(id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 1 AND position <= 8),
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (strategy_axis_id, position)
);

CREATE INDEX idx_action_ideas_strategy_axis_id ON action_ideas(strategy_axis_id);

-- ============================================
-- 2. Execution System Tables
-- ============================================

-- 2.1 projects
-- 프로젝트 (실행 컨텍스트)
CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action_idea_id uuid REFERENCES action_ideas(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    is_inbox boolean NOT NULL DEFAULT false,
    color text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_action_idea_id ON projects(action_idea_id);
CREATE INDEX idx_projects_user_inbox ON projects(user_id, is_inbox);

-- 사용자당 Inbox 프로젝트는 1개만 허용 (부분 UNIQUE 인덱스)
CREATE UNIQUE INDEX unique_inbox_per_user
    ON public.projects(user_id)
    WHERE is_inbox = true;

-- 2.2 tasks
-- 일회성 실행 항목
CREATE TABLE tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action_idea_id uuid REFERENCES action_ideas(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    due_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_action_idea_id ON tasks(action_idea_id);
CREATE INDEX idx_tasks_project_created ON tasks(project_id, created_at DESC);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- 2.3 routines
-- 반복 실행 항목 (일일 반복)
CREATE TABLE routines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action_idea_id uuid REFERENCES action_ideas(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);

CREATE INDEX idx_routines_project_id ON routines(project_id);
CREATE INDEX idx_routines_action_idea_id ON routines(action_idea_id);
CREATE INDEX idx_routines_project_active ON routines(project_id, is_active);

-- 2.4 execution_log
-- 실행 완료 기록 (Task/Routine 완료 로그)
CREATE TABLE execution_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
    routine_id uuid REFERENCES routines(id) ON DELETE CASCADE,
    executed_at date NOT NULL,
    executed_at_time timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    -- Task 또는 Routine 중 하나만 존재해야 함
    CONSTRAINT check_task_or_routine CHECK (
        (task_id IS NOT NULL AND routine_id IS NULL) OR 
        (task_id IS NULL AND routine_id IS NOT NULL)
    )
);

CREATE INDEX idx_execution_log_user_id ON execution_log(user_id);
CREATE INDEX idx_execution_log_task_id ON execution_log(task_id);
CREATE INDEX idx_execution_log_routine_id ON execution_log(routine_id);
CREATE INDEX idx_execution_log_user_executed ON execution_log(user_id, executed_at DESC);
CREATE INDEX idx_execution_log_task_executed ON execution_log(task_id, executed_at DESC);
CREATE INDEX idx_execution_log_routine_executed ON execution_log(routine_id, executed_at DESC);

-- 같은 Task는 하루에 한 번만 완료 가능 (부분 인덱스)
CREATE UNIQUE INDEX unique_task_per_day 
    ON execution_log(user_id, task_id, executed_at) 
    WHERE task_id IS NOT NULL;

-- 같은 Routine은 하루에 한 번만 완료 가능 (부분 인덱스)
CREATE UNIQUE INDEX unique_routine_per_day 
    ON execution_log(user_id, routine_id, executed_at) 
    WHERE routine_id IS NOT NULL;

-- 2.5 monthly_focus
-- 월간 집중 프로젝트 선택 (여러 프로젝트 선택 가능)
CREATE TABLE monthly_focus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    year integer NOT NULL,
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- 사용자별 연월당 같은 프로젝트 중복 방지
    UNIQUE (user_id, year, month, project_id)
);

CREATE INDEX idx_monthly_focus_user_id ON monthly_focus(user_id);
CREATE INDEX idx_monthly_focus_project_id ON monthly_focus(project_id);
CREATE INDEX idx_monthly_focus_user_year_month ON monthly_focus(user_id, year, month);

-- 2.6 weekly_planning
-- 주간 계획 (Task 우선순위 관리)
CREATE TABLE weekly_planning (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    week_start_date date NOT NULL,
    priority integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- 같은 주에 같은 Task 중복 방지
    UNIQUE (user_id, week_start_date, task_id)
);

CREATE INDEX idx_weekly_planning_user_id ON weekly_planning(user_id);
CREATE INDEX idx_weekly_planning_task_id ON weekly_planning(task_id);
CREATE INDEX idx_weekly_planning_user_week_priority ON weekly_planning(user_id, week_start_date, priority);
CREATE INDEX idx_weekly_planning_task_week ON weekly_planning(task_id, week_start_date);

-- 2.7 weekly_review
-- 주간 회고
CREATE TABLE weekly_review (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    week_start_date date NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- 사용자별 주당 회고 1개만
    UNIQUE (user_id, week_start_date)
);

CREATE INDEX idx_weekly_review_user_id ON weekly_review(user_id);
CREATE INDEX idx_weekly_review_user_week ON weekly_review(user_id, week_start_date);

-- ============================================
-- 3. Triggers
-- ============================================

-- 3.1 updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 모든 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mandarat_updated_at BEFORE UPDATE ON mandarat
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_axis_updated_at BEFORE UPDATE ON strategy_axis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_ideas_updated_at BEFORE UPDATE ON action_ideas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON routines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_focus_updated_at BEFORE UPDATE ON monthly_focus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_planning_updated_at BEFORE UPDATE ON weekly_planning
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_review_updated_at BEFORE UPDATE ON weekly_review
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.2 Inbox 프로젝트 자동 생성 트리거
-- profiles 테이블에 새 사용자가 생성될 때 자동으로 Inbox 프로젝트 생성
CREATE OR REPLACE FUNCTION create_inbox_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO projects (user_id, name, is_inbox)
    VALUES (NEW.id, 'Inbox', true);
    RETURN NEW;
END;
$$;

CREATE TRIGGER create_inbox_on_profile_insert
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_inbox_project();

-- Security hardening: revoke PUBLIC execute on trigger function
REVOKE ALL ON FUNCTION public.create_inbox_project() FROM PUBLIC;

-- ============================================
-- 4. Row Level Security (RLS) Policies
-- ============================================

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandarat ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_axis ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_review ENABLE ROW LEVEL SECURITY;

-- profiles: 사용자는 자신의 프로필만 조회/수정 가능
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- mandarat: 사용자는 자신의 만다라트만 조회/수정 가능
CREATE POLICY "Users can view own mandarat"
    ON mandarat FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mandarat"
    ON mandarat FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mandarat"
    ON mandarat FOR UPDATE
    USING (auth.uid() = user_id);

-- strategy_axis: 사용자는 자신의 전략 축만 조회/수정 가능
CREATE POLICY "Users can manage own strategy_axis"
    ON strategy_axis FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM mandarat
            WHERE mandarat.id = strategy_axis.mandarat_id
            AND mandarat.user_id = auth.uid()
        )
    );

-- action_ideas: 사용자는 자신의 실행 아이디어만 조회/수정 가능
CREATE POLICY "Users can manage own action_ideas"
    ON action_ideas FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM strategy_axis
            JOIN mandarat ON mandarat.id = strategy_axis.mandarat_id
            WHERE strategy_axis.id = action_ideas.strategy_axis_id
            AND mandarat.user_id = auth.uid()
        )
    );

-- projects: 사용자는 자신의 프로젝트만 조회/수정 가능
CREATE POLICY "Users can manage own projects"
    ON projects FOR ALL
    USING (auth.uid() = user_id);

-- tasks: 사용자는 자신의 Task만 조회/수정 가능
CREATE POLICY "Users can manage own tasks"
    ON tasks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- routines: 사용자는 자신의 Routine만 조회/수정 가능
CREATE POLICY "Users can manage own routines"
    ON routines FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = routines.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- execution_log: 사용자는 자신의 실행 로그만 조회/수정 가능
CREATE POLICY "Users can manage own execution_log"
    ON execution_log FOR ALL
    USING (auth.uid() = user_id);

-- monthly_focus: 사용자는 자신의 월간 집중만 조회/수정 가능
CREATE POLICY "Users can manage own monthly_focus"
    ON monthly_focus FOR ALL
    USING (auth.uid() = user_id);

-- weekly_planning: 사용자는 자신의 주간 계획만 조회/수정 가능
CREATE POLICY "Users can manage own weekly_planning"
    ON weekly_planning FOR ALL
    USING (auth.uid() = user_id);

-- weekly_review: 사용자는 자신의 주간 회고만 조회/수정 가능
CREATE POLICY "Users can manage own weekly_review"
    ON weekly_review FOR ALL
    USING (auth.uid() = user_id);

-- ============================================
-- Migration Complete
-- ============================================


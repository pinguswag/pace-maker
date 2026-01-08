# 2026 Goal Planner - Database Schema Design

## 1. 테이블 목록 및 목적

### Goal Structuring 영역
1. **profiles** - 사용자 프로필 및 만다라트 완료 상태 관리
2. **mandarat** - 만다라트 메인 (연간 목표)
3. **strategy_axis** - 8개 전략 축
4. **action_ideas** - 64개 실행 아이디어

### Execution System 영역
5. **projects** - 프로젝트 (실행 컨텍스트)
6. **tasks** - 일회성 실행 항목
7. **routines** - 반복 실행 항목 (일일 반복)
8. **execution_log** - 실행 완료 기록 (Task/Routine 완료 로그)
9. **monthly_focus** - 월간 집중 프로젝트 선택
10. **weekly_planning** - 주간 계획 (Task 우선순위)
11. **weekly_review** - 주간 회고

---

## 2. 테이블 상세 스키마

### 2.1 profiles
**목적**: 사용자 프로필 및 만다라트 완료 여부 관리

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, FK → auth.users(id) | 사용자 ID |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |
| mandarat_completed | boolean | NOT NULL, DEFAULT false | 만다라트 완료 여부 |

**인덱스**: `id` (PK)

---

### 2.2 mandarat
**목적**: 만다라트 메인 (연간 목표)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 만다라트 ID |
| user_id | uuid | FK → profiles(id) ON DELETE CASCADE, UNIQUE | 사용자 ID (1:1) |
| yearly_goal | text | NOT NULL | 연간 목표 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**인덱스**: 
- `id` (PK)
- `user_id` (UNIQUE, FK)

---

### 2.3 strategy_axis
**목적**: 8개 전략 축

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 전략 축 ID |
| mandarat_id | uuid | FK → mandarat(id) ON DELETE CASCADE, NOT NULL | 만다라트 ID |
| position | integer | NOT NULL, CHECK (position >= 1 AND position <= 8) | 위치 (1-8) |
| title | text | NOT NULL | 전략 축 제목 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**인덱스**: 
- `id` (PK)
- `mandarat_id` (FK)
- `(mandarat_id, position)` (UNIQUE) - 만다라트당 위치 중복 방지

---

### 2.4 action_ideas
**목적**: 64개 실행 아이디어 (Project/Task/Routine의 Source)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 실행 아이디어 ID |
| strategy_axis_id | uuid | FK → strategy_axis(id) ON DELETE CASCADE, NOT NULL | 전략 축 ID |
| position | integer | NOT NULL, CHECK (position >= 1 AND position <= 8) | 전략 축 내 위치 (1-8) |
| content | text | NOT NULL | 실행 아이디어 내용 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**인덱스**: 
- `id` (PK)
- `strategy_axis_id` (FK)
- `(strategy_axis_id, position)` (UNIQUE) - 전략 축당 위치 중복 방지

---

### 2.5 projects
**목적**: 프로젝트 (실행 컨텍스트)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 프로젝트 ID |
| user_id | uuid | FK → profiles(id) ON DELETE CASCADE, NOT NULL | 사용자 ID |
| action_idea_id | uuid | FK → action_ideas(id) ON DELETE SET NULL, NULL | 실행 아이디어 ID (선택적) |
| name | text | NOT NULL | 프로젝트 이름 |
| description | text | NULL | 프로젝트 설명 |
| is_inbox | boolean | NOT NULL, DEFAULT false | Inbox 프로젝트 여부 |
| color | text | NULL | 프로젝트 색상 (UI용) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |
| archived_at | timestamptz | NULL | 아카이브 일시 |

**제약조건**:
- `(user_id, is_inbox)` UNIQUE WHERE is_inbox = true - 사용자당 Inbox 프로젝트 1개만

**인덱스**: 
- `id` (PK)
- `user_id` (FK)
- `action_idea_id` (FK)
- `(user_id, is_inbox)` - 사용자별 Inbox 조회용

---

### 2.6 tasks
**목적**: 일회성 실행 항목

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Task ID |
| project_id | uuid | FK → projects(id) ON DELETE CASCADE, NOT NULL | 프로젝트 ID |
| action_idea_id | uuid | FK → action_ideas(id) ON DELETE SET NULL, NULL | 실행 아이디어 ID (선택적) |
| title | text | NOT NULL | Task 제목 |
| description | text | NULL | Task 설명 |
| due_date | date | NULL | 마감일 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |
| archived_at | timestamptz | NULL | 아카이브 일시 |

**인덱스**: 
- `id` (PK)
- `project_id` (FK)
- `action_idea_id` (FK)
- `(project_id, created_at DESC)` - 프로젝트별 Task 조회용
- `due_date` - 마감일 기준 조회용

---

### 2.7 routines
**목적**: 반복 실행 항목 (일일 반복)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Routine ID |
| project_id | uuid | FK → projects(id) ON DELETE CASCADE, NOT NULL | 프로젝트 ID |
| action_idea_id | uuid | FK → action_ideas(id) ON DELETE SET NULL, NULL | 실행 아이디어 ID (선택적) |
| title | text | NOT NULL | Routine 제목 |
| description | text | NULL | Routine 설명 |
| is_active | boolean | NOT NULL, DEFAULT true | 활성화 여부 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |
| archived_at | timestamptz | NULL | 아카이브 일시 |

**인덱스**: 
- `id` (PK)
- `project_id` (FK)
- `action_idea_id` (FK)
- `(project_id, is_active)` - 활성 Routine 조회용

---

### 2.8 execution_log
**목적**: 실행 완료 기록 (Task/Routine 완료 로그)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 실행 로그 ID |
| user_id | uuid | FK → profiles(id) ON DELETE CASCADE, NOT NULL | 사용자 ID |
| task_id | uuid | FK → tasks(id) ON DELETE CASCADE, NULL | Task ID (Task 또는 Routine 중 하나) |
| routine_id | uuid | FK → routines(id) ON DELETE CASCADE, NULL | Routine ID (Task 또는 Routine 중 하나) |
| executed_at | date | NOT NULL | 실행일 (날짜 기준) |
| executed_at_time | timestamptz | NOT NULL, DEFAULT now() | 실행 일시 (정확한 시간) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |

**제약조건**: 
- `CHECK ((task_id IS NOT NULL AND routine_id IS NULL) OR (task_id IS NULL AND routine_id IS NOT NULL))` - Task 또는 Routine 중 하나만 존재
- `UNIQUE (user_id, task_id, executed_at)` - 같은 Task는 하루에 한 번만 완료 가능
- `UNIQUE (user_id, routine_id, executed_at)` - 같은 Routine은 하루에 한 번만 완료 가능

**인덱스**: 
- `id` (PK)
- `user_id` (FK)
- `task_id` (FK)
- `routine_id` (FK)
- `(user_id, executed_at DESC)` - 사용자별 일자별 조회용
- `(task_id, executed_at DESC)` - Task별 실행 이력 조회용
- `(routine_id, executed_at DESC)` - Routine별 실행 이력 조회용

---

### 2.9 monthly_focus
**목적**: 월간 집중 프로젝트 선택

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 월간 집중 ID |
| user_id | uuid | FK → profiles(id) ON DELETE CASCADE, NOT NULL | 사용자 ID |
| project_id | uuid | FK → projects(id) ON DELETE CASCADE, NOT NULL | 프로젝트 ID |
| year | integer | NOT NULL | 연도 |
| month | integer | NOT NULL, CHECK (month >= 1 AND month <= 12) | 월 (1-12) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**제약조건**:
- `UNIQUE (user_id, year, month, project_id)` - 사용자별 연월당 같은 프로젝트 중복 방지 (여러 프로젝트 선택 가능)

**인덱스**: 
- `id` (PK)
- `user_id` (FK)
- `project_id` (FK)
- `(user_id, year, month)` - 사용자별 연월별 집중 프로젝트 조회용

---

### 2.10 weekly_planning
**목적**: 주간 계획 (Task 우선순위 관리)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 주간 계획 ID |
| user_id | uuid | FK → profiles(id) ON DELETE CASCADE, NOT NULL | 사용자 ID |
| task_id | uuid | FK → tasks(id) ON DELETE CASCADE, NOT NULL | Task ID |
| week_start_date | date | NOT NULL | 주 시작일 (월요일) |
| priority | integer | NOT NULL, DEFAULT 0 | 우선순위 (낮을수록 높은 우선순위, DnD용) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**제약조건**:
- `UNIQUE (user_id, week_start_date, task_id)` - 같은 주에 같은 Task 중복 방지

**인덱스**: 
- `id` (PK)
- `user_id` (FK)
- `task_id` (FK)
- `(user_id, week_start_date, priority)` - 주간 계획 조회 및 정렬용
- `(task_id, week_start_date)` - Task별 주간 계획 조회용

---

### 2.11 weekly_review
**목적**: 주간 회고

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 주간 회고 ID |
| user_id | uuid | FK → profiles(id) ON DELETE CASCADE, NOT NULL | 사용자 ID |
| week_start_date | date | NOT NULL | 주 시작일 (월요일) |
| notes | text | NULL | 회고 메모 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**인덱스**: 
- `id` (PK)
- `user_id` (FK)
- `(user_id, week_start_date)` (UNIQUE) - 사용자별 주당 하나만

---

## 3. 관계도 (Foreign Keys)

```
profiles (1) ──< (1) mandarat
                └─< (8) strategy_axis
                    └─< (8) action_ideas
                └─< (N) projects
                    ├─< (N) tasks
                    └─< (N) routines
                └─< (N) monthly_focus
                └─< (N) weekly_planning
                └─< (N) weekly_review
                └─< (N) execution_log

action_ideas (1) ──< (0..1) projects
                └─< (0..1) tasks
                └─< (0..1) routines

projects (1) ──< (N) tasks
            └─< (N) routines
            └─< (N) monthly_focus

tasks (1) ──< (N) execution_log
        └─< (N) weekly_planning

routines (1) ──< (N) execution_log
```

---

## 4. 제안 인덱스 요약

### 고유 인덱스 (UNIQUE)
- `mandarat.user_id` - 사용자당 만다라트 1개
- `strategy_axis(mandarat_id, position)` - 만다라트당 전략 축 위치 중복 방지
- `action_ideas(strategy_axis_id, position)` - 전략 축당 실행 아이디어 위치 중복 방지
- `projects(user_id, is_inbox) WHERE is_inbox = true` - 사용자당 Inbox 프로젝트 1개
- `monthly_focus(user_id, year, month, project_id)` - 사용자별 연월당 같은 프로젝트 중복 방지
- `weekly_planning(user_id, week_start_date, task_id)` - 같은 주에 같은 Task 중복 방지
- `execution_log(user_id, task_id, executed_at)` - 같은 Task는 하루에 한 번만 완료
- `execution_log(user_id, routine_id, executed_at)` - 같은 Routine은 하루에 한 번만 완료
- `weekly_review(user_id, week_start_date)` - 사용자별 주당 회고 1개

### 조회 최적화 인덱스
- `projects(user_id, is_inbox)` - 사용자별 Inbox 프로젝트 조회
- `tasks(project_id, created_at DESC)` - 프로젝트별 Task 최신순 조회
- `routines(project_id, is_active)` - 프로젝트별 활성 Routine 조회
- `execution_log(user_id, executed_at DESC)` - 사용자별 일자별 실행 기록 조회
- `execution_log(task_id, executed_at DESC)` - Task별 실행 이력 조회
- `execution_log(routine_id, executed_at DESC)` - Routine별 실행 이력 조회
- `weekly_planning(user_id, week_start_date, priority)` - 주간 계획 조회 및 정렬
- `weekly_planning(task_id, week_start_date)` - Task별 주간 계획 조회

---

## 5. 핵심 제약사항 및 규칙

1. **Mandarat 완료 전 Execution System 잠금**: `profiles.mandarat_completed = false`일 때 projects, tasks, routines 등 접근 제한 (애플리케이션 레벨)

2. **모든 실행 항목은 project_id 필수**: 
   - `tasks.project_id` NOT NULL
   - `routines.project_id` NOT NULL
   - 빠른 캡처 시 기본값으로 Inbox 프로젝트 사용

3. **Inbox 프로젝트 자동 생성**: 
   - 사용자 생성 시 `is_inbox = true`인 프로젝트 자동 생성 (트리거로 구현)
   - 사용자당 정확히 1개의 Inbox 프로젝트만 존재 (UNIQUE 제약조건)

4. **완료는 execution_log에 기록**: 
   - Task/Routine 완료 시 `execution_log`에 INSERT만 수행
   - Task/Routine 자체는 수정하지 않음
   - 같은 Task/Routine은 하루에 한 번만 완료 가능 (UNIQUE 제약조건)

5. **Week/Day는 시간 슬라이스**: 
   - `weekly_planning.week_start_date`는 필터링용
   - `execution_log.executed_at`는 날짜 기준 조회용
   - Task를 소유하는 컨테이너가 아님

6. **Action Ideas는 선택적 연결**: 
   - Project/Task/Routine은 `action_idea_id`가 NULL일 수 있음 (직접 생성 가능)
   - 만다라트에서 파생된 경우에만 연결

---

## 6. 추가 고려사항

### 트리거/함수 필요
- **사용자 생성 시 Inbox 프로젝트 자동 생성**: `profiles` INSERT 시 트리거로 `projects`에 Inbox 프로젝트 생성
- **`updated_at` 자동 업데이트**: 모든 테이블의 `updated_at` 컬럼 자동 업데이트

### RLS (Row Level Security) 정책
- 모든 테이블에 `user_id` 기반 RLS 정책 필요
- 사용자는 자신의 데이터만 접근 가능

### 데이터 무결성
- `execution_log`의 Task/Routine 중 하나만 존재하도록 CHECK 제약조건
- `weekly_planning`의 `week_start_date`는 항상 월요일이어야 함 (애플리케이션 레벨 검증)


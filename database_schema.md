# 2026 Goal Planner - Database Schema Design

## 1. 테이블 목록 및 목적

### Goal Structuring 영역 (현재 적용됨)
1. **mandarat_boards** - 만다라트 보드 (연간 목표) ✅
2. **mandarat_strategies** - 8개 전략 ✅
3. **mandarat_actions** - 64개 실행 아이디어 ✅

### Execution System 영역 (MVP 1.0)
4. **projects** - 프로젝트 (실행 컨텍스트) ✅
5. **monthly_focus** - 월간 집중 프로젝트 선택 ✅
6. **weekly_tasks** - 주간 작업 (정규화된 행 구조) ✅
7. **routines** - 반복 실행 항목 ✅
8. **routine_completions** - 루틴 완료 기록 ✅

---

## 2. 테이블 상세 스키마

### 2.1 Mandarat Tables (현재 적용됨)

#### mandarat_boards
**목적**: 만다라트 보드 (연간 목표)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 보드 ID |
| user_id | uuid | NOT NULL, UNIQUE | 사용자 ID (1:1) |
| yearly_goal | text | NOT NULL, DEFAULT '' | 연간 목표 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**인덱스**: 
- `id` (PK)
- `user_id` (UNIQUE)

**RLS**: 활성화됨, 사용자별 접근 제어

---

#### mandarat_strategies
**목적**: 8개 전략

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 전략 ID |
| board_id | uuid | FK → mandarat_boards(id) ON DELETE CASCADE | 보드 ID |
| strategy_index | int | NOT NULL, CHECK (0-7) | 전략 인덱스 (0-7) |
| text_value | text | NOT NULL, DEFAULT '' | 전략 텍스트 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**인덱스**: 
- `id` (PK)
- `(board_id, strategy_index)` (UNIQUE)

**RLS**: 활성화됨, 보드 소유자만 접근

---

#### mandarat_actions
**목적**: 64개 실행 아이디어 (8 strategies × 8 actions)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 액션 ID |
| board_id | uuid | FK → mandarat_boards(id) ON DELETE CASCADE | 보드 ID |
| strategy_index | int | NOT NULL, CHECK (0-7) | 전략 인덱스 |
| action_index | int | NOT NULL, CHECK (0-7) | 액션 인덱스 |
| text_value | text | NOT NULL, DEFAULT '' | 액션 텍스트 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일시 |

**인덱스**: 
- `id` (PK)
- `(board_id, strategy_index, action_index)` (UNIQUE)

**RLS**: 활성화됨, 보드 소유자만 접근

---

### 2.2 MVP 1.0 Domain Tables

#### projects
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

## 3. 관계도 (Foreign Keys)

```
auth.users (1) ──< (1) mandarat_boards
                └─< (8) mandarat_strategies
                └─< (64) mandarat_actions
                └─< (N) projects
                └─< (N) monthly_focus
                └─< (N) weekly_tasks
                └─< (N) routines
                └─< (N) routine_completions

mandarat_boards (1) ──< (8) mandarat_strategies
                  └─< (64) mandarat_actions

projects (1) ──< (N) weekly_tasks (optional)
          └─< (N) monthly_focus.project_ids (array reference)

routines (1) ──< (N) routine_completions
```

---

## 4. 인덱스 요약

### 고유 인덱스 (UNIQUE)
- `mandarat_boards.user_id` - 사용자당 만다라트 보드 1개
- `mandarat_strategies(board_id, strategy_index)` - 보드당 전략 인덱스 중복 방지
- `mandarat_actions(board_id, strategy_index, action_index)` - 보드당 액션 인덱스 중복 방지
- `monthly_focus(user_id, month_key)` - 사용자별 월당 집중 설정 1개
- `routine_completions(user_id, date_key, routine_id)` - 같은 루틴은 하루에 한 번만 완료

### 조회 최적화 인덱스
- `projects(user_id)` - 사용자별 프로젝트 조회
- `projects(user_id, status)` - 사용자별 상태별 프로젝트 조회
- `monthly_focus(user_id, month_key)` - 사용자별 월별 집중 프로젝트 조회
- `weekly_tasks(user_id, week_key)` - 사용자별 주별 작업 조회
- `weekly_tasks(user_id, week_key, project_id)` - 프로젝트별 주별 작업 조회
- `weekly_tasks(user_id, week_key, picked_for_today)` - 오늘 선택된 작업 조회
- `routines(user_id, is_active)` - 사용자별 활성 루틴 조회
- `routine_completions(user_id, date_key)` - 사용자별 날짜별 완료 기록 조회

---

## 5. 핵심 제약사항 및 규칙

1. **Mandarat 테이블은 독립적**: 
   - `mandarat_boards`, `mandarat_strategies`, `mandarat_actions`는 기존 스키마 유지
   - 다른 테이블과 직접적인 FK 관계 없음

2. **Monthly Focus 제한**: 
   - `monthly_focus.project_ids` 배열은 최대 3개까지만 허용 (CHECK 제약조건)
   - 사용자별 월당 하나의 집중 설정만 존재 (UNIQUE 제약조건)

3. **Weekly Tasks 정규화**: 
   - 각 작업은 독립적인 행으로 저장 (정규화된 구조)
   - `project_id`는 선택적 (NULL 허용, ON DELETE SET NULL)
   - 프로젝트 삭제 시 작업은 유지되지만 프로젝트 참조는 NULL로 설정

4. **Routine Completions**: 
   - 같은 루틴은 하루에 한 번만 완료 기록 가능 (UNIQUE 제약조건)
   - 루틴 삭제 시 완료 기록도 함께 삭제 (ON DELETE CASCADE)

5. **Week/Day는 키 기반**: 
   - `week_key`는 "YYYY-Www" 형식 (ISO 주 번호)
   - `date_key`는 "YYYY-MM-DD" 형식
   - 애플리케이션 레벨에서 키 생성 및 검증

---

## 6. 추가 고려사항

### 트리거/함수
- **`updated_at` 자동 업데이트**: `public.set_updated_at()` 함수로 모든 테이블의 `updated_at` 컬럼 자동 업데이트
- 모든 새 테이블에 트리거 적용됨

### RLS (Row Level Security) 정책
- 모든 새 테이블에 RLS 활성화
- 사용자는 자신의 데이터만 SELECT/INSERT/UPDATE/DELETE 가능
- `auth.uid() = user_id` 기반 정책

### 데이터 무결성
- `monthly_focus.project_ids` 배열 길이 제한 (최대 3개)
- `routine_completions`의 중복 방지 (UNIQUE 제약조건)
- FK 참조 무결성 (ON DELETE CASCADE/SET NULL)


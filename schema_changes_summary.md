# 데이터베이스 스키마 변경사항 요약

## 적용된 변경사항

### 1. Authentication
**변경 내용**: Supabase Auth 사용 유지
- `profiles.id`가 `auth.users(id)`를 참조하도록 유지
- RLS 정책에서 `auth.uid()` 사용

---

### 2. Inbox 프로젝트 자동 생성
**변경 내용**: 
- `projects` 테이블에 `UNIQUE (user_id, is_inbox) WHERE is_inbox = true` 제약조건 추가
- 사용자당 정확히 1개의 Inbox 프로젝트만 허용
- `profiles` INSERT 시 자동으로 Inbox 프로젝트를 생성하는 트리거 추가

**구현**:
```sql
-- 제약조건
CONSTRAINT unique_inbox_per_user UNIQUE (user_id, is_inbox) 
    WHERE is_inbox = true

-- 트리거
CREATE TRIGGER create_inbox_on_profile_insert
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_inbox_project();
```

---

### 3. Weekly Planning 무결성
**변경 내용**: 
- 같은 주에 같은 Task가 중복으로 계획되지 않도록 제약조건 추가
- `UNIQUE (user_id, week_start_date, task_id)` 제약조건 추가

**구현**:
```sql
UNIQUE (user_id, week_start_date, task_id)
```

---

### 4. Monthly Focus - 여러 프로젝트 선택 가능
**변경 내용**: 
- 기존: `UNIQUE (user_id, year, month)` - 연월당 1개 프로젝트만
- 변경: `UNIQUE (user_id, year, month, project_id)` - 연월당 여러 프로젝트 선택 가능, 중복만 방지

**구현**:
```sql
UNIQUE (user_id, year, month, project_id)
```

---

### 5. Execution Log - 하루에 한 번만 완료
**변경 내용**: 
- 같은 Task는 하루에 한 번만 완료 가능하도록 제약조건 추가
- 같은 Routine은 하루에 한 번만 완료 가능하도록 제약조건 추가
- 기존 CHECK 제약조건 유지 (Task 또는 Routine 중 하나만 존재)

**구현**:
```sql
-- 같은 Task는 하루에 한 번만 (부분 인덱스)
CREATE UNIQUE INDEX unique_task_per_day 
    ON execution_log(user_id, task_id, executed_at) 
    WHERE task_id IS NOT NULL;

-- 같은 Routine은 하루에 한 번만 (부분 인덱스)
CREATE UNIQUE INDEX unique_routine_per_day 
    ON execution_log(user_id, routine_id, executed_at) 
    WHERE routine_id IS NOT NULL;
```

**참고**: 부분 인덱스(partial index)를 사용하여 NULL 값 처리를 명확히 했습니다.

---

## 최종 스키마 특징

### 제약조건 요약
1. **Inbox 프로젝트**: 사용자당 1개만 (`UNIQUE (user_id, is_inbox) WHERE is_inbox = true`)
2. **Weekly Planning**: 같은 주에 같은 Task 중복 방지 (`UNIQUE (user_id, week_start_date, task_id)`)
3. **Monthly Focus**: 연월당 같은 프로젝트 중복 방지, 여러 프로젝트 선택 가능 (`UNIQUE (user_id, year, month, project_id)`)
4. **Execution Log**: 
   - Task는 하루에 한 번만 완료 (`UNIQUE (user_id, task_id, executed_at)`)
   - Routine은 하루에 한 번만 완료 (`UNIQUE (user_id, routine_id, executed_at)`)
   - Task 또는 Routine 중 하나만 존재 (`CHECK` 제약조건)

### 트리거
1. **updated_at 자동 업데이트**: 모든 테이블의 `updated_at` 컬럼 자동 업데이트
2. **Inbox 프로젝트 자동 생성**: `profiles` INSERT 시 자동으로 Inbox 프로젝트 생성

### RLS 정책
- 모든 테이블에 RLS 활성화
- 사용자는 자신의 데이터만 접근 가능 (`auth.uid() = user_id` 또는 관련 테이블을 통한 간접 확인)

---

## 마이그레이션 파일

완전한 SQL 마이그레이션 파일: `supabase_migration.sql`

이 파일에는 다음이 포함됩니다:
- 모든 테이블 생성 (CREATE TABLE)
- 모든 인덱스 생성
- 모든 제약조건 (UNIQUE, CHECK, FOREIGN KEY)
- 트리거 함수 및 트리거
- RLS 정책


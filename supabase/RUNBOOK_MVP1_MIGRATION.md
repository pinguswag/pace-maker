# MVP 1.0 도메인 테이블 마이그레이션 실행 가이드

## 사전 준비사항

- ✅ Supabase 프로젝트에 접근 가능
- ✅ 기존 Mandarat 테이블 (`mandarat_boards`, `mandarat_strategies`, `mandarat_actions`)이 이미 존재함
- ✅ SQL Editor 실행 권한

## 실행 단계

### 1단계: Supabase Dashboard 열기

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 해당 프로젝트 선택
3. 왼쪽 사이드바에서 **SQL Editor** 클릭

### 2단계: Apply Script 실행

1. SQL Editor에서 새 쿼리 탭 열기
2. `supabase/APPLY_MVP1_MIGRATION.sql` 파일의 전체 내용을 복사
3. SQL Editor에 붙여넣기
4. **RUN** 버튼 클릭 (또는 `Cmd/Ctrl + Enter`)
5. 실행 완료 대기 (약 1-2초 소요)

**예상 결과:**
- ✅ "Success. No rows returned" 메시지 표시
- ✅ 에러 없이 완료

**주의사항:**
- ⚠️ 에러가 발생하면 에러 메시지를 확인하고 중단
- ⚠️ 기존 Mandarat 테이블은 수정되지 않아야 함

### 3단계: Verification Script 실행

1. SQL Editor에서 새 쿼리 탭 열기 (또는 기존 탭 비우기)
2. `supabase/VERIFY_MVP1_MIGRATION.sql` 파일의 전체 내용을 복사
3. SQL Editor에 붙여넣기
4. **RUN** 버튼 클릭

### 4단계: 검증 결과 확인

다음 결과를 확인하세요:

#### ✅ 테이블 존재 확인
- `projects` → ✓ EXISTS
- `monthly_focus` → ✓ EXISTS
- `weekly_tasks` → ✓ EXISTS
- `routines` → ✓ EXISTS
- `routine_completions` → ✓ EXISTS

**예상 결과:** 5개 테이블 모두 ✓ EXISTS

---

#### ✅ RLS 활성화 확인
- 모든 테이블의 `status` 컬럼이 `✓ ENABLED`여야 함

**예상 결과:** 5개 테이블 모두 ✓ ENABLED

---

#### ✅ RLS 정책 확인
- 각 테이블마다 `policy_count`가 `4`여야 함
- `status`가 `✓ COMPLETE (4 policies)`여야 함

**예상 결과:**
- `projects`: ✓ COMPLETE (4 policies)
- `monthly_focus`: ✓ COMPLETE (4 policies)
- `weekly_tasks`: ✓ COMPLETE (4 policies)
- `routines`: ✓ COMPLETE (4 policies)
- `routine_completions`: ✓ COMPLETE (4 policies)

---

#### ✅ 트리거 확인
- 각 테이블마다 `trigger_count`가 `1` 이상이어야 함
- `status`가 `✓ EXISTS`여야 함

**예상 결과:** 5개 테이블 모두 ✓ EXISTS

---

#### ✅ 함수 확인
- `set_updated_at` 함수가 존재해야 함

**예상 결과:** `set_updated_at` → ✓ EXISTS

---

#### ✅ UNIQUE 제약조건 확인
- `monthly_focus`: `(user_id, month_key)` UNIQUE
- `routine_completions`: `(user_id, date_key, routine_id)` UNIQUE

**예상 결과:** 2개 제약조건 모두 ✓ EXISTS

---

#### ✅ CHECK 제약조건 확인
- `monthly_focus`: 배열 길이 체크 (최대 3개)

**예상 결과:** 1개 제약조건 ✓ EXISTS

---

#### ✅ Foreign Key 확인
다음 FK와 ON DELETE 동작을 확인:

| 테이블 | 컬럼 | 참조 테이블 | ON DELETE | 상태 |
|--------|------|------------|-----------|------|
| `projects` | `user_id` | `auth.users` | CASCADE | ✓ CORRECT |
| `monthly_focus` | `user_id` | `auth.users` | CASCADE | ✓ CORRECT |
| `weekly_tasks` | `user_id` | `auth.users` | CASCADE | ✓ CORRECT |
| `weekly_tasks` | `project_id` | `projects` | SET NULL | ✓ CORRECT |
| `routines` | `user_id` | `auth.users` | CASCADE | ✓ CORRECT |
| `routine_completions` | `user_id` | `auth.users` | CASCADE | ✓ CORRECT |
| `routine_completions` | `routine_id` | `routines` | CASCADE | ✓ CORRECT |

**예상 결과:** 모든 FK가 ✓ CORRECT

---

#### ✅ 인덱스 확인
다음 인덱스들이 존재해야 함:

**projects:**
- `idx_projects_user_id`
- `idx_projects_user_status`

**monthly_focus:**
- `idx_monthly_focus_user_month`

**weekly_tasks:**
- `idx_weekly_tasks_user_week`
- `idx_weekly_tasks_user_week_project`
- `idx_weekly_tasks_user_week_picked`

**routines:**
- `idx_routines_user_active`

**routine_completions:**
- `idx_routine_completions_user_date`

**예상 결과:** 총 8개 인덱스 모두 ✓ EXISTS

---

#### ✅ Summary 확인
마지막 Summary 섹션에서:

1. **Expected Tables: 5** → `actual: 5` → ✓ MATCH
2. **Expected Policies: 20** → `actual: 20` → ✓ MATCH
3. **Expected Triggers: 5** → `actual: 5` → ✓ MATCH

**예상 결과:** 모든 항목이 ✓ MATCH

---

## 문제 해결

### 에러: "relation already exists"
- ✅ 정상입니다. 스크립트는 idempotent하므로 이미 존재하는 테이블은 건너뜁니다.
- 계속 진행하세요.

### 에러: "permission denied"
- ⚠️ Supabase 프로젝트의 관리자 권한이 필요합니다.
- 프로젝트 소유자에게 문의하세요.

### 에러: "extension pgcrypto does not exist"
- ⚠️ Supabase 프로젝트 설정에서 확장 기능이 비활성화되어 있을 수 있습니다.
- Supabase 지원팀에 문의하세요.

### 검증 결과가 예상과 다름
- ⚠️ Apply Script를 다시 실행해보세요 (idempotent하므로 안전합니다).
- 여전히 문제가 있으면 에러 메시지를 확인하고 Supabase 로그를 확인하세요.

---

## 완료 후 확인사항

마이그레이션이 성공적으로 완료되면:

1. ✅ 5개 테이블이 생성됨
2. ✅ 모든 테이블에 RLS 활성화됨
3. ✅ 모든 테이블에 4개씩 RLS 정책 존재
4. ✅ 모든 테이블에 updated_at 트리거 존재
5. ✅ 모든 제약조건과 인덱스가 올바르게 설정됨
6. ✅ 기존 Mandarat 테이블은 변경되지 않음

---

## 참고사항

### 마이그레이션 파일 타임스탬프
현재 마이그레이션 파일 이름: `20260109140504_mvp1_domain_tables.sql`

- ✅ SQL Editor에서 직접 실행할 때는 타임스탬프가 과거여도 문제없습니다.
- ⚠️ Git 저장소에서는 향후 마이그레이션 순서를 위해 현재 타임스탬프로 유지하는 것을 권장합니다.

### 다음 단계
마이그레이션 완료 후:
1. 애플리케이션 코드에서 새 테이블 사용 시작
2. 기존 localStorage 데이터를 Supabase로 마이그레이션 (별도 작업)

---

## 지원

문제가 발생하면:
1. Supabase Dashboard → Logs에서 에러 로그 확인
2. Verification Script의 결과를 저장
3. 필요시 개발팀에 문의

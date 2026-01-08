'use client'

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환합니다.
 */
export function getDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 월 키를 YYYY-MM 형식으로 반환합니다.
 */
export function getMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * 주의 시작(월요일) Date 객체를 반환합니다.
 */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay() || 7 // 일요일은 7로 처리
  result.setDate(result.getDate() - day + 1)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * ISO 주 키를 반환합니다. (YYYY-Www)
 * 기존 주간 플랜에서 사용하던 형식을 유지합니다.
 */
export function getWeekKey(date: Date): string {
  const year = date.getFullYear()

  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const jan4Monday = new Date(jan4)
  jan4Monday.setDate(jan4.getDate() - jan4Day + 1)
  jan4Monday.setHours(0, 0, 0, 0)

  const currentMonday = getStartOfWeek(date)

  const diffTime = currentMonday.getTime() - jan4Monday.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNum = Math.floor(diffDays / 7) + 1

  if (weekNum < 1) {
    const prevYear = year - 1
    const prevJan4 = new Date(prevYear, 0, 4)
    const prevJan4Day = prevJan4.getDay() || 7
    const prevJan4Monday = new Date(prevJan4)
    prevJan4Monday.setDate(prevJan4.getDate() - prevJan4Day + 1)
    prevJan4Monday.setHours(0, 0, 0, 0)
    const prevDiffTime = currentMonday.getTime() - prevJan4Monday.getTime()
    const prevDiffDays = Math.floor(prevDiffTime / (1000 * 60 * 60 * 24))
    const finalWeekNum = Math.floor(prevDiffDays / 7) + 1
    const weekStr = String(finalWeekNum).padStart(2, '0')
    return `${prevYear}-W${weekStr}`
  }

  if (weekNum > 52) {
    const nextYear = year + 1
    const nextJan4 = new Date(nextYear, 0, 4)
    const nextJan4Day = nextJan4.getDay() || 7
    const nextJan4Monday = new Date(nextJan4)
    nextJan4Monday.setDate(nextJan4.getDate() - nextJan4Day + 1)
    nextJan4Monday.setHours(0, 0, 0, 0)
    const nextDiffTime = currentMonday.getTime() - nextJan4Monday.getTime()
    const nextDiffDays = Math.floor(nextDiffTime / (1000 * 60 * 60 * 24))
    const finalWeekNum = Math.floor(nextDiffDays / 7) + 1
    const weekStr = String(finalWeekNum).padStart(2, '0')
    return `${nextYear}-W${weekStr}`
  }

  const weekStr = String(weekNum).padStart(2, '0')
  return `${year}-W${weekStr}`
}

/**
 * 데이터 변경 이벤트를 브로드캐스트합니다.
 * localStorage에 데이터를 저장한 후 이 함수를 호출하면
 * 다른 탭이나 컴포넌트에서 데이터 변경을 감지할 수 있습니다.
 */
export function emitDataChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('app:data-changed'))
}

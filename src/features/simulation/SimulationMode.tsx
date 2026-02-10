import './SimulationMode.css'

/**
 * 시뮬레이션 모드: 시간에 따른 흐름 분석
 * Phase 1: UI만 준비. 실제 엔진 연동은 이후 단계에서.
 */
export function SimulationMode() {
  return (
    <div className="simulation-mode">
      <section className="simulation-header">
        <h2>시뮬레이션</h2>
        <p className="simulation-desc">
          배치·테스트에서 만든 레이아웃을 불러와, 시간에 따른 처리량·대기·전력 등을 분석합니다.
        </p>
      </section>
      <section className="simulation-placeholder">
        <p>Phase 2에서 구현 예정</p>
        <ul>
          <li>시나리오 불러오기 (저장된 배치)</li>
          <li>시뮬레이션 시간·입고 속도 설정</li>
          <li>재생 / 일시정지 / 스텝</li>
          <li>처리량·대기 시간·전력 차트</li>
        </ul>
      </section>
    </div>
  )
}

/**
 * 물류 시뮬레이션 공통 타입 정의
 * Phase 1: 최소 필드만. 이후 단계에서 확장.
 */

/**
 * 장비 종류 (1차: 입고·출고·컨베이어·기계1)
 * 향후 확장: 기계별 크기(그리드 칸 수), 입출력 포트 위치·개수 등 고정 예정.
 */
export type EquipmentKind =
  | 'inbound'    // 입고
  | 'outbound'   // 출고
  | 'conveyor'   // 컨베이어
  | 'machine1'   // 기계1 (추후 기계2 등 확장)
  | 'storage'    // 보관 (과거 호환)
  | 'processor'  // 가공 (과거 호환)

/** 그리드 셀 한 칸의 위치 */
export interface GridPosition {
  row: number
  col: number
}

/** 배치된 장비 한 개 */
export interface PlacedEquipment {
  id: string
  kind: EquipmentKind
  position: GridPosition
  /**
   * 0, 90, 180, 270 (도).
   * 컨베이어: 출력(내보내는) 방향. 입력은 inputDirection.
   * 기계1: 가공 후 내보내는 방향. (추후 다양한 재료·가공 형태 확장)
   * 기타: 출구 방향 등.
   */
  rotation: number
  /**
   * 컨베이어: 받는 쪽(입력 방향). 0=→, 90=↓, 180=←, 270=↑.
   * 없으면 모든 방향 허용(과거 호환). 입력≠출력이면 방향전환(코너).
   */
  inputDirection?: number
  /** 이동 속도 (칸/초) - conveyor 등 */
  speed?: number
  /** 처리 속도 (개/분) - processor, inbound, outbound 등 */
  throughput?: number
  /** 소비 전력 (kW) */
  powerKw?: number
}

/** 맵(배치) 전체 */
export interface LayoutMap {
  rows: number
  cols: number
  equipment: PlacedEquipment[]
}

/** 시뮬레이션 설정 (Phase 2에서 확장) */
export interface SimulationConfig {
  durationMinutes: number
  inboundRatePerMinute: number
  /** 나중에: 전력 제한, 우선순위 등 */
}

// --- 작업 환경·슬롯·버전 관리 ---

/** 슬롯 하나 = 한 가지 배치/시나리오를 작업하는 단위 (여러 사람 또는 여러 시나리오 구분) */
export interface Slot {
  id: string
  /** 표시 이름 (사용자 지정) */
  name: string
  createdAt: string // ISO 8601
  updatedAt: string
  /** 현재 배치 데이터 */
  layout: LayoutMap
  /** 시뮬레이션 설정 (선택) */
  simulationConfig?: SimulationConfig
}

/** 슬롯 내 버전 하나 (이전 상태로 복원용) */
export interface SlotVersion {
  id: string
  slotId: string
  savedAt: string // ISO 8601
  /** 사용자 메모 (예: "초기 배치", "출고구 추가") */
  label?: string
  /** 그 시점의 스냅샷 */
  layout: LayoutMap
  simulationConfig?: SimulationConfig
}

/** 앱 전체 작업 환경 상태 (로컬 저장용) */
export interface WorkspaceState {
  /** 현재 선택된 슬롯 ID */
  currentSlotId: string | null
  /** 슬롯 목록 */
  slots: Slot[]
  /** 슬롯별 버전 히스토리 (slotId → 최근 N개). Phase 1 이후 구현 시 확장 */
  versionsBySlotId?: Record<string, SlotVersion[]>
}

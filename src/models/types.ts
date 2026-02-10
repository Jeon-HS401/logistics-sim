/**
 * 물류 시뮬레이션 공통 타입 정의
 * Phase 1: 최소 필드만. 이후 단계에서 확장.
 */

/** 장비 종류 (1차: 일부만 사용) */
export type EquipmentKind =
  | 'conveyor'   // 컨베이어
  | 'inbound'   // 입고구
  | 'outbound'  // 출고구
  | 'storage'   // 보관(창고)
  | 'processor' // 가공/처리 장비

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
  /** 0, 90, 180, 270 (도) - 출구 방향 등 */
  rotation: number
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

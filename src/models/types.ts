/**
 * 물류 시뮬레이션 공통 타입 정의
 * factory_simulator_v_1_작업_명세서.md 기준 확장. 기존 LayoutMap/PlacedEquipment 호환 유지.
 */

/** 물품 ID (원자재 A,B,C / 가공품 A1,B1,C1). 명세서 item_id에 대응 */
export type ItemType = 'A' | 'B' | 'C' | 'A1' | 'B1' | 'C1'

/**
 * 장비 종류
 * 명세 §4.2 기초 생산 기계, §4.3 합성 생산 기계 반영
 */
export type EquipmentKind =
  | 'inbound'
  | 'outbound'
  | 'conveyor'
  | 'power_provider'
  | 'smelter'           // 정련로 3×3
  | 'crusher'           // 분쇄기 3×3
  | 'parts_processor'   // 부품가공기 3×3
  | 'former'            // 성형기 3×3
  | 'seed_extractor'    // 씨앗 추출기 5×5
  | 'cultivator'        // 재배기 5×5
  | 'equipment_parts'   // 장비 부품 생성기 4×6
  | 'filler'            // 충진기 4×6
  | 'packer'            // 포장기 4×6
  | 'polisher'          // 연마기 4×6
  | 'storage'
  | 'processor'
  // 과거 호환
  | 'machine1'

/**
 * 그리드 셀 위치.
 * 명세서 §1.3: Zone 내부 x: 0~width-1, y: 0~height-1, 좌하단 원점.
 * 현재 구현: row = y축(0=상단), col = x축. 화면은 row 0 상단 기준.
 */
export interface GridPosition {
  row: number
  col: number
}

/** 장비가 차지하는 칸 수 (없으면 1×1) */
export interface EquipmentSize {
  width: number
  height: number
}

/** 배치된 장비 한 개 */
export interface PlacedEquipment {
  id: string
  kind: EquipmentKind
  /** 기준 위치(다칸일 때는 상단·좌측 등). */
  position: GridPosition
  /**
   * 0, 90, 180, 270 (도).
   * 컨베이어: 출력(내보내는) 방향. 입력은 inputDirection.
   * 기계1: 가공 후 내보내는 방향.
   * 기타: 출구 방향 등.
   */
  rotation: number
  /**
   * 컨베이어: 받는 쪽(입력 방향). 0=→, 90=↓, 180=←, 270=↑.
   * 없으면 모든 방향 허용(과거 호환).
   * 방향전환 = 이 셀에서 진입 방향과 이탈 방향이 다름(코너).
   */
  inputDirection?: number
  /** 여러 칸 차지 시 (예: 기계1 2×2). 없으면 1×1. */
  size?: EquipmentSize
  /**
   * 출고(outbound) 전용: 이 출고 포트에서 창고의 어떤 물품을 내보낼지 (품목 ID 문자열).
   */
  outboundSelectedItem?: string
  /**
   * 기계 전용: 활성 레시피 ID. 없으면 입력 자원에 맞게 자동 선택.
   */
  activeRecipeId?: string
  /** 이동 속도 (칸/초) - conveyor 등 */
  speed?: number
  /** 처리 속도 (개/분) - processor, inbound, outbound 등 */
  throughput?: number
  /** 소비 전력 (kW) */
  powerKw?: number
}

/** 맵(배치) 전체. 명세서 Zone의 격자+장비 목록에 대응 (단일 Zone 시) */
export interface LayoutMap {
  rows: number
  cols: number
  equipment: PlacedEquipment[]
  /**
   * 창고 보유량. 명세 §2.1 warehouse inventory[item_id]=int.
   * 품목 ID(문자열)별 수량. 레시피 품목 또는 기존 A/B/C 등.
   */
  warehouseInventory?: Partial<Record<string, number>>
  /**
   * 자체 생산(공장 외부) 원자재의 분당 공급량(개/분).
   * 오리지늄, 자수정, 페리움 등. 시뮬레이션 시 매 tick 해당량만큼 창고에 가산.
   */
  externalSupplyRates?: Partial<Record<string, number>>
}

/** 시뮬레이션 설정 (Phase 2에서 확장) */
export interface SimulationConfig {
  durationMinutes: number
  inboundRatePerMinute: number
  /** 나중에: 전력 제한, 우선순위 등 */
}

// --- 명세서 §7 데이터 구조 대응 (확장) ---

/** 명세 §2.1: 모든 Zone이 공유하는 창고. inventory[item_id] = 수량 */
export interface Warehouse {
  inventory: Partial<Record<ItemType, number>>
}

/** 명세 §1.1: 직사각 격자 Zone. grid·장비 목록은 layout으로 표현 가능 */
export interface Zone {
  id: string
  width: number
  height: number
  /** 현재는 단일 Zone 내용 = LayoutMap과 동일 구조 */
  layout: LayoutMap
}

/** 명세 §6: tick_sec 0.5, 컨베이어 4 tick당 1칸 */
export const TICK_SEC = 0.5
export const CONVEYOR_TICKS_PER_MOVE = 4

/** 기계 생산: 1틱당 진행 시간(초). process_time_sec=2면 2틱에 완료 → 3틱 시작 시 5틱에 출력 */
export const MACHINE_PROGRESS_PER_TICK = 1

/** 명세 §4.5: 기계 입력·출력 버퍼 최대 개수 */
export const MACHINE_BUFFER_CAPACITY = 50

/**
 * 기계 한 대의 런타임 상태 (Phase B).
 * 활성 레시피는 layout의 PlacedEquipment.activeRecipeId 또는 입력 기준 자동 선택.
 */
export interface MachineRuntimeState {
  /** 품목별 입력 버퍼 수량. 합계 ≤ MACHINE_BUFFER_CAPACITY */
  inBuffer: Partial<Record<string, number>>
  /** 품목별 출력 버퍼 수량. 합계 ≤ MACHINE_BUFFER_CAPACITY */
  outBuffer: Partial<Record<string, number>>
  /** 현재 작업 진행 시간(초). 레시피 process_time_sec 도달 시 완료 → 출력 버퍼 적재 */
  progressSec: number
  /** 진행 중인 레시피 ID. 작업 시작 시 설정, 완료 시 초기화 */
  currentRecipeId: string | null
  /** 전력 공급 여부. false면 생산 진행·출력 배출 중단 (입력 흡입은 가능) */
  powered: boolean
}

/** Phase C: 품목별 누적 수량. 단위 통일(개). */
export interface SimulationStats {
  /** 품목별 기계 출력 누적(생산) */
  produced: Partial<Record<string, number>>
  /** 품목별 기계 입력 누적(소비) */
  consumed: Partial<Record<string, number>>
  /** 품목별 출고 누적 */
  outbound: Partial<Record<string, number>>
  /** 품목별 입고 누적 */
  inbound: Partial<Record<string, number>>
  /** 품목별 외부 공급 누적(원자재 분당 공급 반영) */
  externalSupply: Partial<Record<string, number>>
}

/**
 * 시뮬레이션 런타임 상태 (매 tick 갱신).
 * cellItems: 셀별 아이템. key = "row,col", value = item_id.
 * machineStates: 기계(flow 기계)별 버퍼·진행·전력. key = PlacedEquipment.id.
 */
export interface SimulationState {
  currentTick: number
  cellItems: Record<string, string>
  warehouse: Partial<Record<string, number>>
  /** 기계별 런타임 상태. 포트 있는 기계만 포함 */
  machineStates: Record<string, MachineRuntimeState>
  /** Phase C: 품목별 누적 생산/소비/출고/입고/외부공급(개) */
  stats?: SimulationStats
}

/** 명세 §7 World: zones, warehouse, current_tick */
export interface World {
  zones: Zone[]
  warehouse: Warehouse
  current_tick: number
}

/** 명세 §2.3: 입출력 포트 1×3. Zone 외곽(좌/하) 배치, connectCell에서 격자와 접속 */
export type PortEdge = 'left' | 'bottom'

export interface PortBase {
  id: string
  /** 1×3: 물류라인 접촉 길이 3 */
  length: number
  edge: PortEdge
  /** 격자와 접속하는 셀 (1×3의 중앙 등) */
  connectPosition: GridPosition
}

export interface InputPort extends PortBase {
  kind: 'input'
}

export interface OutputPort extends PortBase {
  kind: 'output'
  item_id: ItemType
}

/** 명세 §5.1: 전력공급기 2×2, 중심 기준 12×12 범위 */
export interface PowerProviderSpec {
  width: number
  height: number
  /** 공급 반경 (중심 기준 격자 칸 수). 명세 예: 12 → 12×12 */
  range: number
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

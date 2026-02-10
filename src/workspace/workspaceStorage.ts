/**
 * 작업 환경(슬롯·저장) 로컬 스토리지
 * - Phase 1: 로컬만. 이후 서버 연동 시 같은 타입/인터페이스로 확장 가능.
 */

import type {
  LayoutMap,
  WorkspaceState,
  Slot,
  SlotVersion,
} from '../models/types'

const STORAGE_KEY = 'logistics-sim-workspace'

const DEFAULT_LAYOUT: LayoutMap = {
  rows: 32,
  cols: 32,
  equipment: [],
}

function now(): string {
  return new Date().toISOString()
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 로컬에서 전체 작업 환경 불러오기 */
export function loadWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getInitialState()
    const parsed = JSON.parse(raw) as WorkspaceState
    if (!parsed.slots || !Array.isArray(parsed.slots)) return getInitialState()
    return {
      currentSlotId: parsed.currentSlotId ?? null,
      slots: parsed.slots,
      versionsBySlotId: parsed.versionsBySlotId ?? {},
    }
  } catch {
    return getInitialState()
  }
}

/** 전체 작업 환경 저장 */
export function saveWorkspace(state: WorkspaceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('workspace save failed', e)
  }
}

/** 초기 상태: 슬롯 0개, currentSlotId null */
export function getInitialState(): WorkspaceState {
  return {
    currentSlotId: null,
    slots: [],
    versionsBySlotId: {},
  }
}

/** 빈 슬롯 하나 생성 */
export function createSlot(name: string): Slot {
  const id = generateId()
  const t = now()
  return {
    id,
    name: name || `슬롯 ${id.slice(-6)}`,
    createdAt: t,
    updatedAt: t,
    layout: { ...DEFAULT_LAYOUT, equipment: [] },
  }
}

/** 슬롯 내용 업데이트 후 updatedAt 갱신 (이름·배치·시뮬 설정) */
export function updateSlot(
  slot: Slot,
  patch: Partial<Pick<Slot, 'name' | 'layout' | 'simulationConfig'>>
): Slot {
  return {
    ...slot,
    ...patch,
    updatedAt: now(),
  }
}

const MAX_VERSIONS_PER_SLOT = 20

/** 현재 슬롯에 대한 버전 스냅샷 생성 */
export function createVersionFromSlot(slot: Slot, label?: string): SlotVersion {
  return {
    id: generateId(),
    slotId: slot.id,
    savedAt: now(),
    label,
    layout: JSON.parse(JSON.stringify(slot.layout)),
    simulationConfig: slot.simulationConfig ? { ...slot.simulationConfig } : undefined,
  }
}

/** workspace에 버전 추가 (슬롯별 최대 개수 유지) */
export function addVersion(
  state: WorkspaceState,
  slotId: string,
  label?: string
): WorkspaceState {
  const slot = state.slots.find((s) => s.id === slotId)
  if (!slot) return state
  const version = createVersionFromSlot(slot, label)
  const prev = state.versionsBySlotId?.[slotId] ?? []
  const next = [version, ...prev].slice(0, MAX_VERSIONS_PER_SLOT)
  return {
    ...state,
    versionsBySlotId: { ...state.versionsBySlotId, [slotId]: next },
  }
}

/** 버전 스냅샷으로 슬롯 내용 복원 */
export function restoreSlotFromVersion(slot: Slot, version: SlotVersion): Slot {
  return updateSlot(slot, {
    layout: JSON.parse(JSON.stringify(version.layout)),
    simulationConfig: version.simulationConfig
      ? { ...version.simulationConfig }
      : undefined,
  })
}

/**
 * 시뮬레이션 Tick 엔진
 * 명세 §6.2 순서: 출고 → 컨베이어 이동 → 기계 입력 흡입 → 기계 생산 → 기계 출력 배출 → 입고
 */

import type { LayoutMap, SimulationState, SimulationStats } from '../../models/types'
import { CONVEYOR_TICKS_PER_MOVE, MACHINE_BUFFER_CAPACITY, MACHINE_PROGRESS_PER_TICK, TICK_SEC } from '../../models/types'
import {
  canMoveToNextCell,
  getEquipmentAt,
  getMachineInputPortCells,
  getMachineOutputPortNextCells,
  getNextCell,
  getOccupiedCells,
  getOutboundOutputCell,
} from '../layout/pathUtils'
import { EQUIPMENT_SPECS } from '../../data/equipmentSpecs'
import { EQUIPMENT_KIND_TO_MACHINE_ID } from '../../data/powerConsumption'
import {
  getProcessTimeSec,
  getRecipeByRecipeId,
  getRecipesByMachineId,
  getDefaultRecipeIdForInput,
  getRecipeItemIds,
} from '../../data/recipes'
import type { RecipeSpec } from '../../data/recipes'

const cellKey = (row: number, col: number) => `${row},${col}`

/** 전력 공급 범위: 배치 모드와 동일 (provider 기준 12×12 박스) */
const POWER_RANGE_ROW_MIN = -5
const POWER_RANGE_ROW_MAX = 6
const POWER_RANGE_COL_MIN = -5
const POWER_RANGE_COL_MAX = 6

function isFlowMachine(kind: string): boolean {
  return EQUIPMENT_SPECS[kind as keyof typeof EQUIPMENT_SPECS]?.ports != null
}

function isCellPowered(layout: LayoutMap, row: number, col: number): boolean {
  for (const eq of layout.equipment) {
    if (eq.kind !== 'power_provider') continue
    const r0 = eq.position.row
    const c0 = eq.position.col
    if (
      row >= r0 + POWER_RANGE_ROW_MIN &&
      row <= r0 + POWER_RANGE_ROW_MAX &&
      col >= c0 + POWER_RANGE_COL_MIN &&
      col <= c0 + POWER_RANGE_COL_MAX
    )
      return true
  }
  return false
}

function isMachinePowered(layout: LayoutMap, eq: { id: string; kind: string; position: { row: number; col: number } }): boolean {
  const cells = getOccupiedCells(eq as import('../../models/types').PlacedEquipment)
  return cells.some((c) => isCellPowered(layout, c.row, c.col))
}

function bufferTotal(buf: Partial<Record<string, number>>): number {
  return Object.values(buf).reduce((s: number, n) => s + (n ?? 0), 0)
}

function inBufferSatisfiesRecipe(inBuffer: Partial<Record<string, number>>, recipe: RecipeSpec): boolean {
  const n1 = inBuffer[recipe.input_1.item_id] ?? 0
  if (n1 < recipe.input_1.qty) return false
  if (!recipe.input_2) return true
  const n2 = inBuffer[recipe.input_2.item_id] ?? 0
  return n2 >= recipe.input_2.qty
}

function consumeRecipeInput(inBuffer: Partial<Record<string, number>>, recipe: RecipeSpec): void {
  const a = (inBuffer[recipe.input_1.item_id] ?? 0) - recipe.input_1.qty
  inBuffer[recipe.input_1.item_id] = a <= 0 ? undefined : a
  if (recipe.input_2) {
    const b = (inBuffer[recipe.input_2.item_id] ?? 0) - recipe.input_2.qty
    inBuffer[recipe.input_2.item_id] = b <= 0 ? undefined : b
  }
}

function addRecipeOutput(outBuffer: Partial<Record<string, number>>, recipe: RecipeSpec): void {
  const id = recipe.output.item_id
  outBuffer[id] = (outBuffer[id] ?? 0) + recipe.output.qty
}

function pickOneFromOutBuffer(outBuffer: Partial<Record<string, number>>): string | null {
  for (const [id, n] of Object.entries(outBuffer)) {
    if (n != null && n > 0) return id
  }
  return null
}

function emptyStats(): SimulationStats {
  const itemIds = getRecipeItemIds()
  const empty: Record<string, number> = {}
  for (const id of itemIds) empty[id] = 0
  return {
    produced: { ...empty },
    consumed: { ...empty },
    outbound: { ...empty },
    inbound: { ...empty },
    externalSupply: { ...empty },
  }
}

/** layout·창고 재고로 초기 시뮬 상태 생성. 기계(포트 있는 장비)별 버퍼·진행·전력 초기화 */
export function createInitialSimulationState(layout: LayoutMap): SimulationState {
  const machineStates: SimulationState['machineStates'] = {}
  for (const eq of layout.equipment) {
    if (!isFlowMachine(eq.kind)) continue
    machineStates[eq.id] = {
      inBuffer: {},
      outBuffer: {},
      progressSec: 0,
      currentRecipeId: null,
      powered: isMachinePowered(layout, eq),
    }
  }
  return {
    currentTick: 0,
    cellItems: {},
    warehouse: { ...(layout.warehouseInventory ?? {}) },
    machineStates,
    stats: emptyStats(),
  }
}

function addStat(stats: SimulationStats, key: keyof SimulationStats, itemId: string, delta: number): void {
  const rec = stats[key] as Record<string, number>
  rec[itemId] = (rec[itemId] ?? 0) + delta
}

/** 1 tick 진행. §6.2 순서 적용. (Phase A: 출고·컨베이어·입고만, 기계는 Phase B에서) */
export function runOneTick(layout: LayoutMap, state: SimulationState): SimulationState {
  const rows = layout.rows
  const cols = layout.cols
  let cellItems = { ...state.cellItems }
  let warehouse = { ...state.warehouse }
  const stats: SimulationStats = {
    produced: { ...state.stats?.produced },
    consumed: { ...state.stats?.consumed },
    outbound: { ...state.stats?.outbound },
    inbound: { ...state.stats?.inbound },
    externalSupply: { ...state.stats?.externalSupply },
  }

  // 0. 외부 공급(원자재 분당 공급량). 단위: 개/분 → tick당 개
  const rates = layout.externalSupplyRates ?? {}
  for (const [itemId, perMin] of Object.entries(rates)) {
    const rate = perMin ?? 0
    if (rate <= 0) continue
    const perTick = (rate * TICK_SEC) / 60
    warehouse = { ...warehouse, [itemId]: (warehouse[itemId] ?? 0) + perTick }
    addStat(stats, 'externalSupply', itemId, perTick)
  }

  // 1. 창고 출력 포트 출고 (출력 셀이 비어 있으면 1개 출고, 창고가 빌 때까지 매 tick 반복)
  for (const eq of layout.equipment) {
    if (eq.kind !== 'outbound' || !eq.outboundSelectedItem) continue
    const itemId = eq.outboundSelectedItem
    const stock = warehouse[itemId] ?? 0
    if (stock <= 0) continue
    const out = getOutboundOutputCell(layout, eq)
    if (!out) continue
    const key = cellKey(out.row, out.col)
    if (cellItems[key]) continue
    cellItems = { ...cellItems, [key]: itemId }
    warehouse = { ...warehouse, [itemId]: stock - 1 }
    addStat(stats, 'outbound', itemId, 1)
  }

  // 2. 컨베이어 이동 (명세: 4 tick당 1칸. 일단 매 tick 이동으로 시뮬 동작 검증)
  const moveEveryTick = true
  const onMoveTick = (state.currentTick + 1) % CONVEYOR_TICKS_PER_MOVE === 0
  if (state.currentTick >= 1 && (moveEveryTick || onMoveTick)) {
    const moves: { fromKey: string; toRow: number; toCol: number; itemId: string }[] = []
    for (const eq of layout.equipment) {
      if (eq.kind !== 'conveyor') continue
      const { row, col } = eq.position
      const fromKey = cellKey(row, col)
      const itemId = cellItems[fromKey]
      if (!itemId) continue
      const next = getNextCell(row, col, eq.rotation)
      if (next.row < 0 || next.row >= rows || next.col < 0 || next.col >= cols) continue
      const nextEq = getEquipmentAt(layout, next.row, next.col)
      if (!nextEq) continue
      // 3→4 이동 허용: 다음이 기계(flow)여도 이동. 4(기계 입력 가장자리)에 도착한 뒤 3단계에서 해당 셀에서 흡입.
      const nextKey = cellKey(next.row, next.col)
      if (cellItems[nextKey]) continue
      if (!canMoveToNextCell(layout, row, col, next.row, next.col)) continue
      moves.push({ fromKey, toRow: next.row, toCol: next.col, itemId })
    }
    const toTargets: Record<string, string[]> = {}
    for (const m of moves) {
      const toKey = cellKey(m.toRow, m.toCol)
      if (!toTargets[toKey]) toTargets[toKey] = []
      toTargets[toKey].push(m.fromKey)
    }
    const applied: { fromKey: string; toKey: string; itemId: string }[] = []
    for (const [toKey, fromKeys] of Object.entries(toTargets)) {
      if (fromKeys.length !== 1) continue
      const m = moves.find((x) => cellKey(x.toRow, x.toCol) === toKey && fromKeys[0] === x.fromKey)
      if (!m) continue
      applied.push({ fromKey: m.fromKey, toKey, itemId: m.itemId })
    }
    const fromKeys = new Set(applied.map((m) => m.fromKey))
    const nextCellItems: Record<string, string> = {}
    for (const [key, id] of Object.entries(cellItems)) {
      if (!fromKeys.has(key)) nextCellItems[key] = id
    }
    for (const m of applied) {
      nextCellItems[m.toKey] = m.itemId
    }
    cellItems = nextCellItems
  }

  // 3~5. 기계: 전력 판정 후 입력 흡입 → 생산 진행 → 출력 배출
  let machineStates: SimulationState['machineStates'] = {}
  for (const eq of layout.equipment) {
    if (!isFlowMachine(eq.kind)) continue
    const prev = state.machineStates[eq.id]
    machineStates[eq.id] = {
      ...prev,
      inBuffer: { ...prev?.inBuffer },
      outBuffer: { ...prev?.outBuffer },
      powered: isMachinePowered(layout, eq),
    }
  }

  // 3. 기계 입력 흡입 (맞는 레시피 있는 품목만, 버퍼 여유 있을 때 1개씩)
  for (const eq of layout.equipment) {
    if (!isFlowMachine(eq.kind)) continue
    const ms = machineStates[eq.id]
    if (!ms) continue
    const machineId = EQUIPMENT_KIND_TO_MACHINE_ID[eq.kind] ?? eq.kind
    const inputCells = getMachineInputPortCells(layout, eq)
    for (const { row, col } of inputCells) {
      const key = cellKey(row, col)
      const itemId = cellItems[key]
      if (!itemId) continue
      const recipeId = getDefaultRecipeIdForInput(machineId, itemId)
      if (!recipeId) continue
      if (bufferTotal(ms.inBuffer) >= MACHINE_BUFFER_CAPACITY) continue
      const nextIn = { ...ms.inBuffer, [itemId]: (ms.inBuffer[itemId] ?? 0) + 1 }
      machineStates[eq.id] = { ...ms, inBuffer: nextIn }
      const nextCellItems = { ...cellItems }
      delete nextCellItems[key]
      cellItems = nextCellItems
      break
    }
  }

  // 4. 기계 생산 진행 (전력 있을 때만: 진행 중이면 progress 누적, 완료 시 출력 버퍼 적재; 완료한 틱에 대기 재료 있으면 바로 다음 작업 시작)
  for (const eq of layout.equipment) {
    if (!isFlowMachine(eq.kind)) continue
    const ms = machineStates[eq.id]
    if (!ms || !ms.powered) continue
    const machineId = EQUIPMENT_KIND_TO_MACHINE_ID[eq.kind] ?? eq.kind
    const recipes = getRecipesByMachineId(machineId)
    let stateForNext = ms
    if (ms.currentRecipeId) {
      const recipe = getRecipeByRecipeId(ms.currentRecipeId)
      if (!recipe) {
        machineStates[eq.id] = { ...ms, currentRecipeId: null, progressSec: 0 }
        continue
      }
      const processTime = getProcessTimeSec(recipe)
      const nextProgress = ms.progressSec + MACHINE_PROGRESS_PER_TICK
      if (nextProgress >= processTime) {
        const nextOut = { ...ms.outBuffer }
        addRecipeOutput(nextOut, recipe)
        addStat(stats, 'produced', recipe.output.item_id, recipe.output.qty)
        machineStates[eq.id] = {
          ...ms,
          outBuffer: nextOut,
          progressSec: 0,
          currentRecipeId: null,
        }
        stateForNext = machineStates[eq.id]!
        // 같은 틱에 대기 재료로 다음 작업 시작 가능하도록 fall through
      } else {
        machineStates[eq.id] = { ...ms, progressSec: nextProgress }
        continue
      }
    }
    const recipeId = eq.activeRecipeId ?? recipes.find((r) => inBufferSatisfiesRecipe(stateForNext.inBuffer, r))?.recipe_id ?? null
    if (!recipeId) continue
    const recipe = getRecipeByRecipeId(recipeId)
    if (!recipe || !inBufferSatisfiesRecipe(stateForNext.inBuffer, recipe)) continue
    const nextIn = { ...stateForNext.inBuffer }
    consumeRecipeInput(nextIn, recipe)
    addStat(stats, 'consumed', recipe.input_1.item_id, recipe.input_1.qty)
    if (recipe.input_2) addStat(stats, 'consumed', recipe.input_2.item_id, recipe.input_2.qty)
    machineStates[eq.id] = {
      ...stateForNext,
      inBuffer: nextIn,
      currentRecipeId: recipeId,
      progressSec: 0,
    }
  }

  // 5. 기계 출력 배출 (전력 있을 때만, 출력 셀이 컨베이어/입고/출고이고 비어 있으면 1개씩)
  for (const eq of layout.equipment) {
    if (!isFlowMachine(eq.kind)) continue
    const ms = machineStates[eq.id]
    if (!ms || !ms.powered) continue
    const outputCells = getMachineOutputPortNextCells(layout, eq)
    for (const { row, col } of outputCells) {
      const toEq = getEquipmentAt(layout, row, col)
      if (!toEq || (toEq.kind !== 'conveyor' && toEq.kind !== 'inbound' && toEq.kind !== 'outbound')) continue
      const key = cellKey(row, col)
      if (cellItems[key]) continue
      const itemId = pickOneFromOutBuffer(ms.outBuffer)
      if (!itemId) continue
      const nextOut = { ...ms.outBuffer, [itemId]: (ms.outBuffer[itemId] ?? 0) - 1 }
      if ((nextOut[itemId] ?? 0) <= 0) delete nextOut[itemId]
      machineStates[eq.id] = { ...ms, outBuffer: nextOut }
      cellItems = { ...cellItems, [key]: itemId }
      break
    }
  }

  // 6. 창고 입력 포트 입고
  for (const eq of layout.equipment) {
    if (eq.kind !== 'inbound') continue
    const key = cellKey(eq.position.row, eq.position.col)
    const itemId = cellItems[key]
    if (!itemId) continue
    const nextCellItems = { ...cellItems }
    delete nextCellItems[key]
    cellItems = nextCellItems
    warehouse = { ...warehouse, [itemId]: (warehouse[itemId] ?? 0) + 1 }
    addStat(stats, 'inbound', itemId, 1)
  }

  return {
    currentTick: state.currentTick + 1,
    cellItems,
    warehouse,
    machineStates,
    stats,
  }
}

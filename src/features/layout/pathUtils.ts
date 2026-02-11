/**
 * 배치된 경로 따라 물품 1개 흐름 테스트용 경로 계산
 * 입고 → 컨베이어(입력/출력 방향) / 기계1(출력 방향) → … → 출고
 * 다칸 장비(기계1 2×2) 점유·겹침 검사 지원.
 */

import type { LayoutMap, PlacedEquipment, GridPosition, EquipmentSize } from '../../models/types'
import { EQUIPMENT_SPECS } from '../../data/equipmentSpecs'

// 0°=→, 90°=↓(row 감소), 180°=←, 270°=↑(row 증가). 그리드 row 0=하단, row 증가=위쪽
const ROW_DELTA = [0, -1, 0, 1]
const COL_DELTA = [1, 0, -1, 0]

function rotationToIndex(deg: number): number {
  const i = Math.round((deg % 360) / 90) % 4
  return i < 0 ? i + 4 : i
}

/** 장비가 차지하는 칸 수 (스펙 또는 equipment.size) */
function getSize(eq: PlacedEquipment): EquipmentSize {
  if (eq.size) return eq.size
  const spec = EQUIPMENT_SPECS[eq.kind]
  return { width: spec?.width ?? 1, height: spec?.height ?? 1 }
}

/** 명세 §4 기계(입출력 포트 보유) 여부. 경로 연속 시 컨베이어와 동일 취급 */
function isFlowMachine(eq: PlacedEquipment): boolean {
  return EQUIPMENT_SPECS[eq.kind]?.ports != null
}

/** 한 장비가 점유하는 모든 셀 (기준점 기준) */
export function getOccupiedCells(eq: PlacedEquipment): GridPosition[] {
  const { width, height } = getSize(eq)
  const cells: GridPosition[] = []
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      cells.push({ row: eq.position.row + r, col: eq.position.col + c })
    }
  }
  return cells
}

/** (row,col)이 layout 내 어느 장비에 의해 점유되는지 반환 (다칸 포함) */
export function getEquipmentAt(
  layout: LayoutMap,
  row: number,
  col: number
): PlacedEquipment | undefined {
  if (row < 0 || row >= layout.rows || col < 0 || col >= layout.cols) return undefined
  return layout.equipment.find((e) => {
    const cells = getOccupiedCells(e)
    return cells.some((c) => c.row === row && c.col === col)
  })
}

/** 해당 셀이 이미 어떤 장비에 의해 점유 중인지 */
export function isCellOccupied(layout: LayoutMap, row: number, col: number): boolean {
  return getEquipmentAt(layout, row, col) != null
}

const cellKey = (row: number, col: number) => `${row},${col}`

/** 다칸 장비의 "원점이 아닌" 셀들 (셀 병합 시 비워둘 칸). 원점은 장비 기준 position */
export function getCoveredCellKeys(layout: LayoutMap): Set<string> {
  const covered = new Set<string>()
  for (const eq of layout.equipment) {
    const { width, height } = getSize(eq)
    if (width <= 1 && height <= 1) continue
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (r === 0 && c === 0) continue
        covered.add(cellKey(eq.position.row + r, eq.position.col + c))
      }
    }
  }
  return covered
}

/** (row,col)에 장비를 배치할 때 필요한 칸들이 모두 비어 있는지 (경계 포함) */
export function canPlaceAt(
  layout: LayoutMap,
  row: number,
  col: number,
  size: EquipmentSize
): boolean {
  for (let r = 0; r < size.height; r++) {
    for (let c = 0; c < size.width; c++) {
      const nr = row + r
      const nc = col + c
      if (nr < 0 || nr >= layout.rows || nc < 0 || nc >= layout.cols) return false
      if (isCellOccupied(layout, nr, nc)) return false
    }
  }
  return true
}

/** 이동 시: exceptId 장비가 점유한 칸은 비어 있는 것으로 간주 */
export function canPlaceAtExcept(
  layout: LayoutMap,
  row: number,
  col: number,
  size: EquipmentSize,
  exceptId: string
): boolean {
  for (let r = 0; r < size.height; r++) {
    for (let c = 0; c < size.width; c++) {
      const nr = row + r
      const nc = col + c
      if (nr < 0 || nr >= layout.rows || nc < 0 || nc >= layout.cols) return false
      const eq = getEquipmentAt(layout, nr, nc)
      if (eq != null && eq.id !== exceptId) return false
    }
  }
  return true
}

/** 일괄 이동 시: exceptIds에 있는 장비 칸은 비어 있는 것으로 간주 */
export function canPlaceAtExceptIds(
  layout: LayoutMap,
  row: number,
  col: number,
  size: EquipmentSize,
  exceptIds: Set<string>
): boolean {
  for (let r = 0; r < size.height; r++) {
    for (let c = 0; c < size.width; c++) {
      const nr = row + r
      const nc = col + c
      if (nr < 0 || nr >= layout.rows || nc < 0 || nc >= layout.cols) return false
      const eq = getEquipmentAt(layout, nr, nc)
      if (eq != null && !exceptIds.has(eq.id)) return false
    }
  }
  return true
}

/** (fromRow, fromCol) → (toRow, toCol) 이동 방향. 0=→, 90=↓, 180=←, 270=↑ */
function getMoveDirection(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): number {
  const dr = toRow - fromRow
  const dc = toCol - fromCol
  if (dc === 1 && dr === 0) return 0
  if (dr === -1 && dc === 0) return 90
  if (dc === -1 && dr === 0) return 180
  if (dr === 1 && dc === 0) return 270
  return 0
}

/** rotation(도) 기준 다음 셀 좌표 (1칸) */
export function getNextCell(
  row: number,
  col: number,
  rotation: number
): GridPosition {
  const i = rotationToIndex(rotation)
  return {
    row: row + ROW_DELTA[i],
    col: col + COL_DELTA[i],
  }
}

/**
 * 다칸 기계의 출력 포트별 "다음 셀" 목록 (포트 번호 순).
 * 각 입출력 포트는 동일 작업 수행, 순서 처리·특정 포트만 열린 경우에도 넘버링으로 안전하게 처리.
 */
export function getMachineOutputPortNextCells(
  layout: LayoutMap,
  eq: PlacedEquipment
): { portIndex: number; row: number; col: number }[] {
  const spec = EQUIPMENT_SPECS[eq.kind]
  if (!spec?.ports) {
    const single = getNextCell(eq.position.row, eq.position.col, eq.rotation)
    if (
      single.row < 0 ||
      single.row >= layout.rows ||
      single.col < 0 ||
      single.col >= layout.cols
    )
      return []
    return [{ portIndex: 0, row: single.row, col: single.col }]
  }
  const { width, height } = getSize(eq)
  const portCount = spec.ports.outputPortCount
  const outDir = (spec.ports.outputSide + eq.rotation) % 360
  const i = rotationToIndex(outDir)
  const result: { portIndex: number; row: number; col: number }[] = []
  // 0°=우: (row+r, col+width), 90°=하: (row+height, col+c), 180°=좌: (row+r, col-1), 270°=상: (row-1, col+c)
  if (i === 0) {
    for (let r = 0; r < portCount && r < height; r++) {
      const row = eq.position.row + r
      const col = eq.position.col + width
      if (row >= 0 && row < layout.rows && col >= 0 && col < layout.cols)
        result.push({ portIndex: r, row, col })
    }
  } else if (i === 1) {
    for (let c = 0; c < portCount && c < width; c++) {
      const row = eq.position.row + height
      const col = eq.position.col + c
      if (row >= 0 && row < layout.rows && col >= 0 && col < layout.cols)
        result.push({ portIndex: c, row, col })
    }
  } else if (i === 2) {
    for (let r = 0; r < portCount && r < height; r++) {
      const row = eq.position.row + r
      const col = eq.position.col - 1
      if (row >= 0 && row < layout.rows && col >= 0 && col < layout.cols)
        result.push({ portIndex: r, row, col })
    }
  } else {
    for (let c = 0; c < portCount && c < width; c++) {
      const row = eq.position.row - 1
      const col = eq.position.col + c
      if (row >= 0 && row < layout.rows && col >= 0 && col < layout.cols)
        result.push({ portIndex: c, row, col })
    }
  }
  return result
}

/** 입고 한 곳에서 출고까지의 경로. 기계1·컨베이어 입력방향 반영. */
export function buildPathFromInbound(layout: LayoutMap): GridPosition[] | null {
  const inbound = layout.equipment.find((e) => e.kind === 'inbound')
  if (!inbound) return null

  const path: GridPosition[] = [{ row: inbound.position.row, col: inbound.position.col }]
  const visited = new Set<string>()
  const key = (r: number, c: number) => `${r},${c}`

  visited.add(key(inbound.position.row, inbound.position.col))

  const firstDeltas: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]]
  let current: GridPosition | null = null

  for (const [dr, dc] of firstDeltas) {
    const nr = inbound.position.row + dr
    const nc = inbound.position.col + dc
    if (nr < 0 || nr >= layout.rows || nc < 0 || nc >= layout.cols) continue
    const eq = getEquipmentAt(layout, nr, nc)
    if (eq?.kind === 'outbound') {
      path.push({ row: nr, col: nc })
      return path
    }
    if (eq && (eq.kind === 'conveyor' || isFlowMachine(eq))) {
      current = { row: nr, col: nc }
      path.push(current)
      visited.add(key(nr, nc))
      break
    }
  }

  if (!current) return null

  let fromRow = inbound.position.row
  let fromCol = inbound.position.col

  while (current) {
    const eq = getEquipmentAt(layout, current.row, current.col)
    if (!eq) break

    if (eq.kind === 'conveyor') {
      const fromDir = getMoveDirection(fromRow, fromCol, current.row, current.col)
      if (eq.inputDirection != null && eq.inputDirection !== fromDir) break
      const next = getNextCell(current.row, current.col, eq.rotation)
      fromRow = current.row
      fromCol = current.col
      if (next.row < 0 || next.row >= layout.rows || next.col < 0 || next.col >= layout.cols) break
      if (visited.has(key(next.row, next.col))) break
      const nextEq = getEquipmentAt(layout, next.row, next.col)
      if (nextEq?.kind === 'outbound') {
        path.push(next)
        return path
      }
      if (nextEq && (nextEq.kind === 'conveyor' || isFlowMachine(nextEq))) {
        path.push(next)
        visited.add(key(next.row, next.col))
        current = next
      } else break
    } else if (isFlowMachine(eq)) {
      const outputCells = getMachineOutputPortNextCells(layout, eq)
      let next: GridPosition | null = null
      for (const { row, col } of outputCells) {
        if (visited.has(key(row, col))) continue
        const nextEq = getEquipmentAt(layout, row, col)
        if (nextEq?.kind === 'inbound' || nextEq?.kind === 'outbound') {
          next = { row, col }
          break
        }
        if (nextEq && (nextEq.kind === 'conveyor' || isFlowMachine(nextEq))) {
          next = { row, col }
          break
        }
      }
      if (!next) break
      fromRow = current.row
      fromCol = current.col
      const nextEq = getEquipmentAt(layout, next.row, next.col)
      if (nextEq?.kind === 'inbound') {
        path.push(next)
        return path
      }
      if (nextEq?.kind === 'outbound') {
        path.push(next)
        return path
      }
      path.push(next)
      visited.add(key(next.row, next.col))
      current = next
    } else break
  }

  return null
}

/** 출고 장비에서 시작해 입고/출고/막힘까지 경로. 출고 시 창고에서 선택 품목 차감은 호출측에서. */
export function buildPathFromOutbound(
  layout: LayoutMap,
  outboundId: string
): GridPosition[] | null {
  const outbound = layout.equipment.find((e) => e.kind === 'outbound' && e.id === outboundId)
  if (!outbound) return null

  const path: GridPosition[] = [{ row: outbound.position.row, col: outbound.position.col }]
  const visited = new Set<string>()
  const key = (r: number, c: number) => `${r},${c}`
  visited.add(key(outbound.position.row, outbound.position.col))

  const firstDeltas: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]]
  let current: GridPosition | null = null
  let fromRow = outbound.position.row
  let fromCol = outbound.position.col

  for (const [dr, dc] of firstDeltas) {
    const nr = outbound.position.row + dr
    const nc = outbound.position.col + dc
    if (nr < 0 || nr >= layout.rows || nc < 0 || nc >= layout.cols) continue
    const eq = getEquipmentAt(layout, nr, nc)
    if (eq?.kind === 'inbound') {
      path.push({ row: nr, col: nc })
      return path
    }
    if (eq?.kind === 'outbound') {
      path.push({ row: nr, col: nc })
      return path
    }
    if (eq && (eq.kind === 'conveyor' || isFlowMachine(eq))) {
      current = { row: nr, col: nc }
      path.push(current)
      visited.add(key(nr, nc))
      fromRow = outbound.position.row
      fromCol = outbound.position.col
      break
    }
  }

  if (!current) return path.length > 1 ? path : null

  while (current) {
    const eq = getEquipmentAt(layout, current.row, current.col)
    if (!eq) break

    if (eq.kind === 'conveyor') {
      const fromDir = getMoveDirection(fromRow, fromCol, current.row, current.col)
      if (eq.inputDirection != null && eq.inputDirection !== fromDir) break
      const next = getNextCell(current.row, current.col, eq.rotation)
      fromRow = current.row
      fromCol = current.col
      if (next.row < 0 || next.row >= layout.rows || next.col < 0 || next.col >= layout.cols) break
      if (visited.has(key(next.row, next.col))) break
      const nextEq = getEquipmentAt(layout, next.row, next.col)
      if (nextEq?.kind === 'inbound' || nextEq?.kind === 'outbound') {
        path.push(next)
        return path
      }
      if (nextEq && (nextEq.kind === 'conveyor' || isFlowMachine(nextEq))) {
        path.push(next)
        visited.add(key(next.row, next.col))
        current = next
      } else break
    } else if (isFlowMachine(eq)) {
      const outputCells = getMachineOutputPortNextCells(layout, eq)
      let next: GridPosition | null = null
      for (const { row, col } of outputCells) {
        if (visited.has(key(row, col))) continue
        const nextEq = getEquipmentAt(layout, row, col)
        if (nextEq?.kind === 'inbound' || nextEq?.kind === 'outbound') {
          next = { row, col }
          break
        }
        if (nextEq && (nextEq.kind === 'conveyor' || isFlowMachine(nextEq))) {
          next = { row, col }
          break
        }
      }
      if (!next) break
      fromRow = current.row
      fromCol = current.col
      const nextEq = getEquipmentAt(layout, next.row, next.col)
      if (nextEq?.kind === 'inbound' || nextEq?.kind === 'outbound') {
        path.push(next)
        return path
      }
      path.push(next)
      visited.add(key(next.row, next.col))
      current = next
    } else break
  }

  return path
}

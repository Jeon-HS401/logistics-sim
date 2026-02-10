/**
 * 배치된 경로 따라 물품 1개 흐름 테스트용 경로 계산
 * 입고 → 컨베이어(입력/출력 방향) / 기계1(출력 방향) → … → 출고
 */

import type { LayoutMap, PlacedEquipment, GridPosition } from '../../models/types'

const ROW_DELTA = [0, 1, 0, -1]   // 0°, 90°, 180°, 270°
const COL_DELTA = [1, 0, -1, 0]

function rotationToIndex(deg: number): number {
  const i = Math.round((deg % 360) / 90) % 4
  return i < 0 ? i + 4 : i
}

/** (fromRow, fromCol) → (toRow, toCol) 이동 방향을 0/90/180/270으로 */
function getMoveDirection(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): number {
  const dr = toRow - fromRow
  const dc = toCol - fromCol
  if (dc === 1 && dr === 0) return 0
  if (dr === 1 && dc === 0) return 90
  if (dc === -1 && dr === 0) return 180
  if (dr === -1 && dc === 0) return 270
  return 0
}

export function getEquipmentAt(
  layout: LayoutMap,
  row: number,
  col: number
): PlacedEquipment | undefined {
  if (row < 0 || row >= layout.rows || col < 0 || col >= layout.cols) return undefined
  return layout.equipment.find(
    (e) => e.position.row === row && e.position.col === col
  )
}

/** rotation(도) 기준 다음 셀 좌표 */
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
    if (eq?.kind === 'conveyor' || eq?.kind === 'machine1') {
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
      const inputExpected = (fromDir + 180) % 360
      if (eq.inputDirection != null && eq.inputDirection !== inputExpected) break
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
      if (nextEq?.kind === 'conveyor' || nextEq?.kind === 'machine1') {
        path.push(next)
        visited.add(key(next.row, next.col))
        current = next
      } else break
    } else if (eq.kind === 'machine1') {
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
      if (nextEq?.kind === 'conveyor' || nextEq?.kind === 'machine1') {
        path.push(next)
        visited.add(key(next.row, next.col))
        current = next
      } else break
    } else break
  }

  return null
}

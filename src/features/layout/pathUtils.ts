/**
 * 배치된 경로 따라 물품 1개 흐름 테스트용 경로 계산
 * 입고 → (인접 컨베이어/출고) → 컨베이어 방향 따라 진행 → 출고
 */

import type { LayoutMap, PlacedEquipment, GridPosition } from '../../models/types'

const ROW_DELTA = [0, 1, 0, -1]   // 0°, 90°, 180°, 270°
const COL_DELTA = [1, 0, -1, 0]

function rotationToIndex(deg: number): number {
  const i = Math.round(deg / 90) % 4
  return i < 0 ? i + 4 : i
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

/** 입고 한 곳에서 출고까지의 경로. 없으면 null, 순환 시 빈 배열 등으로 구분 가능 */
export function buildPathFromInbound(layout: LayoutMap): GridPosition[] | null {
  const inbound = layout.equipment.find((e) => e.kind === 'inbound')
  if (!inbound) return null

  const path: GridPosition[] = [{ row: inbound.position.row, col: inbound.position.col }]
  const visited = new Set<string>()
  const key = (r: number, c: number) => `${r},${c}`

  visited.add(key(inbound.position.row, inbound.position.col))

  // 입고 인접 4방 중 컨베이어 또는 출고 찾기
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
    if (eq?.kind === 'conveyor') {
      current = { row: nr, col: nc }
      path.push(current)
      visited.add(key(nr, nc))
      break
    }
  }

  if (!current) return path.length > 1 ? path : null

  // 컨베이어 방향 따라 출고까지 진행
  while (current) {
    const eq = getEquipmentAt(layout, current.row, current.col)
    if (!eq || eq.kind !== 'conveyor') break

    const next = getNextCell(current.row, current.col, eq.rotation)
    if (next.row < 0 || next.row >= layout.rows || next.col < 0 || next.col >= layout.cols) break
    if (visited.has(key(next.row, next.col))) break // 순환

    const nextEq = getEquipmentAt(layout, next.row, next.col)
    if (nextEq?.kind === 'outbound') {
      path.push(next)
      return path
    }
    if (nextEq?.kind === 'conveyor') {
      path.push(next)
      visited.add(key(next.row, next.col))
      current = next
    } else {
      break
    }
  }

  const last = path[path.length - 1]
  const lastEq = last && getEquipmentAt(layout, last.row, last.col)
  if (lastEq?.kind === 'outbound' && path.length >= 2) return path
  return null
}

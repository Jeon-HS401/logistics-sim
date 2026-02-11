/**
 * 명세서 §1.1 Zone 구성
 * Z1: 70×70, Z2: 40×40, Z3: 40×40
 * Phase 1에서는 단일 Zone 사용 시 기본 그리드 크기 선택용.
 */

export const ZONE_PRESETS = [
  { id: 'Z1', name: 'Z1', width: 70, height: 70 },
  { id: 'Z2', name: 'Z2', width: 40, height: 40 },
  { id: 'Z3', name: 'Z3', width: 40, height: 40 },
] as const

export const DEFAULT_ZONE_GRID = { rows: 32, cols: 32 } as const

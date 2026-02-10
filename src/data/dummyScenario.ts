/**
 * 더미 시나리오 데이터
 * - 물품: A, B, C (원자재) → 기계1 경유 시 A1, B1, C1 (가공품)
 * - 기계1: 2×2 크기, 한쪽 2입력/반대쪽 2출력, 방향전환 가능
 * - 입고/출고: 창고와 연결. 입고=모든 물품 창고 적재, 출고=창고에서 선택한 물품만 주기적 출력
 */

import type { ItemType } from '../models/types'

/** 원자재 (기계1 입력 가능) */
export const ITEM_TYPES_RAW: ItemType[] = ['A', 'B', 'C']

/** 가공품 (기계1 출력) */
export const ITEM_TYPES_PROCESSED: ItemType[] = ['A1', 'B1', 'C1']

/** 전체 물품 */
export const ITEM_TYPES_ALL: ItemType[] = [...ITEM_TYPES_RAW, ...ITEM_TYPES_PROCESSED]

/** 기계1: 원자재 → 가공품 변환 */
export const MACHINE1_TRANSFORM: Record<ItemType, ItemType | undefined> = {
  A: 'A1',
  B: 'B1',
  C: 'C1',
  A1: undefined,
  B1: undefined,
  C1: undefined,
}

/** 기계1이 받을 수 있는 물품 */
export const MACHINE1_ACCEPTS: ItemType[] = ['A', 'B', 'C']

/** 기계1 사양 (더미 시나리오) */
export const MACHINE1_SPEC = {
  /** 그리드 상 크기 (가로×세로 칸) */
  width: 2,
  height: 2,
  /** 한쪽 면 입력 포트 수 */
  inputPorts: 2,
  /** 반대쪽 면 출력 포트 수 */
  outputPorts: 2,
  /** 받을 수 있는 물품 */
  accepts: MACHINE1_ACCEPTS,
  /** 변환 규칙 */
  transform: MACHINE1_TRANSFORM,
  /** 방향전환 가능 */
  rotatable: true,
} as const

/** 입고 규칙: 어떤 물품이든 입고에 들어오면 창고로 적재 */
export const INBOUND_RULE = {
  description: '입고: 모든 물품을 창고로 적재',
  accepts: ITEM_TYPES_ALL,
} as const

/** 출고 규칙: 창고와 연결, 출고 포트별로 "창고 내 특정 물품만" 선택 후 주기적으로 출력 */
export const OUTBOUND_RULE = {
  description: '출고: 창고에서 선택한 물품만 해당 출고 포트로 주기 출력',
  source: 'warehouse' as const,
  selectableItems: ITEM_TYPES_ALL,
} as const

/** 창고: 입고에서 받은 물품 보관, 출고 포트가 선택한 품목만 공급 */
export const WAREHOUSE_RULE = {
  description: '창고: 입고 물품 적재 → 출고 포트별 선택 품목 공급',
} as const

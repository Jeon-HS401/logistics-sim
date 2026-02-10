/**
 * 장비 종류별 스펙: 크기, 입출력 포트(어느 변·몇 개)
 * 포트 위치는 position + size + rotation 으로 계산.
 */

import type { EquipmentKind } from '../models/types'

/** 0=→(우), 90=↓, 180=←, 270=↑ (로컬 기준, rotation 적용 전) */
export type Side = 0 | 90 | 180 | 270

export interface EquipmentPortSpec {
  /** 입력 변(로컬). 반대쪽이 출력이면 outputSide = (inputSide + 180) % 360 */
  inputSide: Side
  inputPortCount: number
  outputSide: Side
  outputPortCount: number
}

export interface EquipmentTypeSpec {
  /** 그리드 칸 수. 없으면 1×1 */
  width: number
  height: number
  /** 입출력 포트 (다칸 장비). 컨베이어/입고/출고는 셀 단위로 별도 처리 */
  ports?: EquipmentPortSpec
  rotatable?: boolean
}

const MACHINE1_SPEC: EquipmentTypeSpec = {
  width: 2,
  height: 2,
  rotatable: true,
  ports: {
    inputSide: 180,
    inputPortCount: 2,
    outputSide: 0,
    outputPortCount: 2,
  },
}

/** 1×1, 포트 스펙 없음 (입출력은 inputDirection/rotation으로 표현) */
const CONVEYOR_SPEC: EquipmentTypeSpec = {
  width: 1,
  height: 1,
  rotatable: true,
}

const INBOUND_SPEC: EquipmentTypeSpec = {
  width: 1,
  height: 1,
  rotatable: false,
}

const OUTBOUND_SPEC: EquipmentTypeSpec = {
  width: 1,
  height: 1,
  rotatable: false,
}

/** 장비 종류별 스펙 */
export const EQUIPMENT_SPECS: Record<EquipmentKind, EquipmentTypeSpec> = {
  machine1: MACHINE1_SPEC,
  conveyor: CONVEYOR_SPEC,
  inbound: INBOUND_SPEC,
  outbound: OUTBOUND_SPEC,
  storage: { width: 1, height: 1 },
  processor: { width: 1, height: 1 },
}

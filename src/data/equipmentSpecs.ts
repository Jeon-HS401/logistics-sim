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

/** 명세 §4.2 기초 생산 기계 3×3 입력3 출력3 */
const MACHINE_3X3: EquipmentTypeSpec = {
  width: 3,
  height: 3,
  rotatable: true,
  ports: { inputSide: 180, inputPortCount: 3, outputSide: 0, outputPortCount: 3 },
}

/** 명세 §4.2 씨앗 추출기·재배기 5×5 입력5 출력5 */
const MACHINE_5X5: EquipmentTypeSpec = {
  width: 5,
  height: 5,
  rotatable: true,
  ports: { inputSide: 180, inputPortCount: 5, outputSide: 0, outputPortCount: 5 },
}

/** 명세 §4.3 합성 생산 기계 4×6 입력6 출력6 */
const MACHINE_4X6: EquipmentTypeSpec = {
  width: 6,
  height: 4,
  rotatable: true,
  ports: { inputSide: 180, inputPortCount: 6, outputSide: 0, outputPortCount: 6 },
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

/** 명세 §5.1: 전력공급기 2×2, 중심 기준 12×12 범위 */
const POWER_PROVIDER_SPEC: EquipmentTypeSpec = {
  width: 2,
  height: 2,
  rotatable: false,
}

/** 장비 종류별 스펙 (명세 §4.2, §4.3 반영) */
export const EQUIPMENT_SPECS: Record<EquipmentKind, EquipmentTypeSpec> = {
  conveyor: CONVEYOR_SPEC,
  inbound: INBOUND_SPEC,
  outbound: OUTBOUND_SPEC,
  power_provider: POWER_PROVIDER_SPEC,
  smelter: MACHINE_3X3,
  crusher: MACHINE_3X3,
  parts_processor: MACHINE_3X3,
  former: MACHINE_3X3,
  seed_extractor: MACHINE_5X5,
  cultivator: MACHINE_5X5,
  equipment_parts: MACHINE_4X6,
  filler: MACHINE_4X6,
  packer: MACHINE_4X6,
  polisher: MACHINE_4X6,
  machine1: MACHINE1_SPEC,
  storage: { width: 1, height: 1 },
  processor: { width: 1, height: 1 },
}

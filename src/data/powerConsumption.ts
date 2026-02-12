/**
 * 전력 소모 데이터
 * data/machines.json의 power_consumption과 대응. machine_id는 프로젝트 내부 ID(영문) 사용.
 */

export type PowerCategory =
  | 'mining'
  | 'processing_1'
  | 'processing_2'
  | 'processing_3'
  | 'advanced'

export interface MachinePowerSpec {
  machine_id: string
  machine_name: string
  power_unit_per_sec: number
  category: PowerCategory
}

export const MACHINE_POWER_SPECS: MachinePowerSpec[] = [
  { machine_id: 'miner_1', machine_name: '전동채굴기', power_unit_per_sec: 5, category: 'mining' },
  { machine_id: 'miner_2', machine_name: '전동채굴기2', power_unit_per_sec: 10, category: 'mining' },
  { machine_id: 'pump', machine_name: '양수기', power_unit_per_sec: 10, category: 'mining' },

  { machine_id: 'refinery', machine_name: '정련로', power_unit_per_sec: 5, category: 'processing_1' },
  { machine_id: 'crusher', machine_name: '분쇄기', power_unit_per_sec: 5, category: 'processing_1' },
  { machine_id: 'part_processor', machine_name: '부품가공기', power_unit_per_sec: 20, category: 'processing_2' },
  { machine_id: 'former', machine_name: '성형기', power_unit_per_sec: 10, category: 'processing_2' },
  { machine_id: 'grower', machine_name: '재배기', power_unit_per_sec: 20, category: 'processing_2' },
  { machine_id: 'seed_extractor', machine_name: '씨앗추출기', power_unit_per_sec: 10, category: 'processing_2' },

  { machine_id: 'part_synth', machine_name: '부품합성기', power_unit_per_sec: 10, category: 'processing_3' },
  { machine_id: 'filler', machine_name: '충진기', power_unit_per_sec: 20, category: 'processing_3' },
  { machine_id: 'packer', machine_name: '포장기', power_unit_per_sec: 20, category: 'processing_3' },
  { machine_id: 'reactor', machine_name: '반응기', power_unit_per_sec: 50, category: 'advanced' },
  { machine_id: 'polisher', machine_name: '연마기', power_unit_per_sec: 50, category: 'advanced' },
  { machine_id: 'smelter_high', machine_name: '천화로', power_unit_per_sec: 50, category: 'advanced' },
  { machine_id: 'disassembler', machine_name: '분해기', power_unit_per_sec: 20, category: 'processing_3' },
]

const byId = new Map<string, MachinePowerSpec>()
for (const spec of MACHINE_POWER_SPECS) {
  byId.set(spec.machine_id, spec)
}

export function getPowerSpecByMachineId(machine_id: string): MachinePowerSpec | undefined {
  return byId.get(machine_id)
}

/** 레이아웃 EquipmentKind → 전력 데이터용 machine_id 매핑 (확장 시 추가) */
export const EQUIPMENT_KIND_TO_MACHINE_ID: Record<string, string> = {
  smelter: 'refinery',
  crusher: 'crusher',
  parts_processor: 'part_processor',
  former: 'former',
  cultivator: 'grower',
  seed_extractor: 'seed_extractor',
  equipment_parts: 'part_synth',
  filler: 'filler',
  packer: 'packer',
  polisher: 'polisher',
}

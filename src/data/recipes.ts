/**
 * 레시피 데이터 (확장 가능)
 * machine_id별 입력 품목·수량, 출력 품목·수량
 */

export interface RecipeInput {
  item_id: string
  qty: number
}

export interface RecipeSpec {
  recipe_id: string
  machine_id: string
  input_1: RecipeInput
  input_2?: RecipeInput
  output: RecipeInput
  /** 변환 소요 시간(초). 없으면 UI에서 "—" 등으로 표시 */
  process_time_sec?: number
}

function r(
  recipe_id: string,
  machine_id: string,
  input_1: RecipeInput,
  output: RecipeInput,
  input_2?: RecipeInput,
  process_time_sec?: number
): RecipeSpec {
  const spec: RecipeSpec = { recipe_id, machine_id, input_1, output, input_2 }
  if (process_time_sec != null) spec.process_time_sec = process_time_sec
  return spec
}

export const RECIPE_SPECS: RecipeSpec[] = [
  r('refine_originium', 'refinery', { item_id: '오리지늄', qty: 1 }, { item_id: '오리고 크러스트', qty: 1 }),
  r('refine_amethyst', 'refinery', { item_id: '자수정', qty: 1 }, { item_id: '자수정 섬유', qty: 1 }),
  r('refine_ferium', 'refinery', { item_id: '페리움', qty: 1 }, { item_id: '페리움 조각', qty: 1 }),

  r('part_amethyst', 'part_processor', { item_id: '자수정 섬유', qty: 1 }, { item_id: '자수정 부품', qty: 1 }),
  r('part_ferium', 'part_processor', { item_id: '페리움 조각', qty: 1 }, { item_id: '페리움 부품', qty: 1 }),

  r('form_amethyst_bottle', 'former', { item_id: '자수정 섬유', qty: 2 }, { item_id: '자수정 병', qty: 1 }),
  r('form_ferium_bottle', 'former', { item_id: '페리움 조각', qty: 2 }, { item_id: '페리움 병', qty: 1 }),

  r(
    'equip_part_amethyst',
    'part_synth',
    { item_id: '오리고 크러스트', qty: 5 },
    { item_id: '자수정 장비 부품', qty: 1 },
    { item_id: '자수정 섬유', qty: 5 }
  ),
  r(
    'equip_part_ferium',
    'part_synth',
    { item_id: '오리고 크러스트', qty: 10 },
    { item_id: '페리움 장비 부품', qty: 1 },
    { item_id: '페리움 조각', qty: 10 }
  ),

  r(
    'pack_explosive',
    'packer',
    { item_id: '자수정 부품', qty: 5 },
    { item_id: '폭발물', qty: 1 },
    { item_id: '아케톤 가루', qty: 1 }
  ),
  r(
    'pack_battery_small',
    'packer',
    { item_id: '자수정 부품', qty: 5 },
    { item_id: '저용량 배터리', qty: 1 },
    { item_id: '오리지늄 가루', qty: 10 }
  ),
  r(
    'pack_battery_medium',
    'packer',
    { item_id: '페리움 부품', qty: 10 },
    { item_id: '중용량 배터리', qty: 1 },
    { item_id: '오리지늄 가루', qty: 15 }
  ),

  r(
    'fill_citron_small',
    'filler',
    { item_id: '자수정 병', qty: 5 },
    { item_id: '시트론 통조림', qty: 1 },
    { item_id: '시트론 가루', qty: 5 }
  ),
  r(
    'fill_buckwheat_small',
    'filler',
    { item_id: '자수정 병', qty: 5 },
    { item_id: '메밀꽃 캡슐', qty: 1 },
    { item_id: '메밀꽃 가루', qty: 5 }
  ),
  r(
    'fill_citron_medium',
    'filler',
    { item_id: '페리움 병', qty: 10 },
    { item_id: '시트론 통조림(중)', qty: 1 },
    { item_id: '시트론 가루', qty: 10 }
  ),
  r(
    'fill_buckwheat_medium',
    'filler',
    { item_id: '페리움 병', qty: 10 },
    { item_id: '메밀꽃 캡슐(중)', qty: 1 },
    { item_id: '메밀꽃 가루', qty: 10 }
  ),
]

const byRecipeId = new Map<string, RecipeSpec>()
const byMachineId = new Map<string, RecipeSpec[]>()
for (const spec of RECIPE_SPECS) {
  byRecipeId.set(spec.recipe_id, spec)
  const list = byMachineId.get(spec.machine_id) ?? []
  list.push(spec)
  byMachineId.set(spec.machine_id, list)
}

export function getRecipeByRecipeId(recipe_id: string): RecipeSpec | undefined {
  return byRecipeId.get(recipe_id)
}

export function getRecipesByMachineId(machine_id: string): RecipeSpec[] {
  return byMachineId.get(machine_id) ?? []
}

/** 레시피에 등장하는 모든 품목 ID (입력+출력, 중복 제거, 정렬) */
export function getRecipeItemIds(): string[] {
  const set = new Set<string>()
  for (const spec of RECIPE_SPECS) {
    set.add(spec.input_1.item_id)
    if (spec.input_2) set.add(spec.input_2.item_id)
    set.add(spec.output.item_id)
  }
  return Array.from(set).sort()
}

/**
 * 해당 기계 레시피 중 입력으로 들어오는 품목과 맞는 레시피가 있으면 그 recipe_id 반환.
 * 없으면 null. 기본 레시피(자동) 선택 및 "맞는 레시피 없으면 입력 포트로 들어가지 않음" 판정에 사용.
 */
export function getDefaultRecipeIdForInput(machine_id: string, incoming_item_id: string): string | null {
  const recipes = getRecipesByMachineId(machine_id)
  for (const r of recipes) {
    if (r.input_1.item_id === incoming_item_id) return r.recipe_id
    if (r.input_2?.item_id === incoming_item_id) return r.recipe_id
  }
  return null
}

/** 품목이 어떤 레시피의 출력이면 '가공품', 그렇지 않으면 '원자재'. 창고 테이블 등 재료 특성 표시용 */
export function getItemCategory(item_id: string): '원자재' | '가공품' {
  const isOutput = RECIPE_SPECS.some((r) => r.output.item_id === item_id)
  return isOutput ? '가공품' : '원자재'
}

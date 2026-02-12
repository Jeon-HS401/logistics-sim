/**
 * data/recipes.json, data/machines.json 기반 레시피 로드
 * 한글 기계명 → 프로젝트 내부 machine_id 매핑, 기존 recipe_id 유지
 */

import type { RecipeInput, RecipeSpec } from './recipes'

import recipesJson from '../../data/recipes.json'
import machinesJson from '../../data/machines.json'

/** 한글 기계명 → 내부 machine_id (레시피/전력에서 사용) */
const KOREAN_TO_INTERNAL: Record<string, string> = {
  정련로: 'refinery',
  분쇄기: 'crusher',
  부품가공기: 'part_processor',
  성형기: 'former',
  씨앗추출기: 'seed_extractor',
  재배기: 'grower',
  장비부품합성기: 'part_synth',
  충진기: 'filler',
  포장기: 'packer',
  연마기: 'polisher',
}

/** 기계별 기본 process_time_sec (machines.json, null이면 2) */
const DEFAULT_TIME_BY_KOREAN: Record<string, number> = {}
for (const m of (machinesJson as { machines: { machine_id: string; process_time_sec: number | null }[] }).machines) {
  DEFAULT_TIME_BY_KOREAN[m.machine_id] = m.process_time_sec ?? 2
}

/** 품목 ID 오타 수정 (JSON 초안 반영) */
function fixItemId(id: string): string {
  if (id === '고운 오리고 크러스트 가류') return '고운 오리고 크러스트 가루'
  if (id === '자수정 가로') return '자수정 가루'
  return id
}

/** 기존 recipe_id 유지용: (machine_id, input_1_id, input_2_id?, output_id) → recipe_id */
const EXISTING_IDS: Array<{
  machine_id: string
  in1: string
  in2?: string
  out: string
  recipe_id: string
}> = [
  { machine_id: 'refinery', in1: '오리지늄', out: '오리고 크러스트', recipe_id: 'refine_originium' },
  { machine_id: 'refinery', in1: '자수정', out: '자수정 섬유', recipe_id: 'refine_amethyst' },
  { machine_id: 'refinery', in1: '페리움', out: '페리움 조각', recipe_id: 'refine_ferium' },
  { machine_id: 'part_processor', in1: '자수정 섬유', out: '자수정 부품', recipe_id: 'part_amethyst' },
  { machine_id: 'part_processor', in1: '페리움 조각', out: '페리움 부품', recipe_id: 'part_ferium' },
  { machine_id: 'former', in1: '자수정 섬유', in2: '자수정 섬유', out: '자수정 병', recipe_id: 'form_amethyst_bottle' },
  { machine_id: 'former', in1: '페리움 조각', in2: '페리움 조각', out: '페리움 병', recipe_id: 'form_ferium_bottle' },
  { machine_id: 'part_synth', in1: '오리고 크러스트', in2: '자수정 섬유', out: '자수정 장비 부품', recipe_id: 'equip_part_amethyst' },
  { machine_id: 'part_synth', in1: '오리고 크러스트', in2: '페리움 조각', out: '페리움 장비 부품', recipe_id: 'equip_part_ferium' },
  { machine_id: 'packer', in1: '자수정 부품', in2: '아케톤 가루', out: '폭발물', recipe_id: 'pack_explosive' },
  { machine_id: 'packer', in1: '자수정 부품', in2: '오리지늄 가루', out: '저용량 배터리', recipe_id: 'pack_battery_small' },
  { machine_id: 'packer', in1: '페리움 부품', in2: '오리지늄 가루', out: '중용량 배터리', recipe_id: 'pack_battery_medium' },
  { machine_id: 'filler', in1: '자수정 병', in2: '시트론 가루', out: '시트론 통조림', recipe_id: 'fill_citron_small' },
  { machine_id: 'filler', in1: '자수정 병', in2: '메밀꽃 가루', out: '메밀꽃 캡슐', recipe_id: 'fill_buckwheat_small' },
  { machine_id: 'filler', in1: '페리움 병', in2: '시트론 가루', out: '시트론 통조림(중)', recipe_id: 'fill_citron_medium' },
  { machine_id: 'filler', in1: '페리움 병', in2: '메밀꽃 가루', out: '메밀꽃 캡슐(중)', recipe_id: 'fill_buckwheat_medium' },
]

type JsonRecipe = {
  machine_id: string
  inputs: { item_id: string; qty: number }[]
  outputs: { item_id: string; qty: number }[]
}

function findExistingRecipeId(
  machineId: string,
  in1: RecipeInput,
  in2: RecipeInput | undefined,
  out: RecipeInput
): string | null {
  const in2Id = in2?.item_id
  for (const ex of EXISTING_IDS) {
    if (ex.machine_id !== machineId) continue
    if (ex.out !== out.item_id) continue
    // 두 입력: in1+in2 일치
    if (ex.in2 != null && in2Id != null && ex.in1 === in1.item_id && ex.in2 === in2Id) return ex.recipe_id
    // 단일 입력: in1만 있고, 기존도 in2 없거나 기존이 in1=in2 동일 재료인 경우(수량 2로 들어옴)
    if (ex.in2 == null && in2Id == null && ex.in1 === in1.item_id) return ex.recipe_id
    if (ex.in2 != null && ex.in1 === ex.in2 && in2Id == null && ex.in1 === in1.item_id && in1.qty >= 2) return ex.recipe_id
  }
  return null
}

const recipeIndexByMachine = new Map<string, number>()

function nextRecipeId(machineId: string): string {
  const n = (recipeIndexByMachine.get(machineId) ?? 0) + 1
  recipeIndexByMachine.set(machineId, n)
  return `${machineId}_${n}`
}

function buildRecipeSpecs(): RecipeSpec[] {
  const json = recipesJson as { recipes: JsonRecipe[] }
  const out: RecipeSpec[] = []
  for (const r of json.recipes) {
    const machineId = KOREAN_TO_INTERNAL[r.machine_id]
    if (!machineId) continue
    const inp0 = r.inputs[0]
    const inp1 = r.inputs[1]
    const out0 = r.outputs[0]
    if (!inp0 || !out0) continue
    const input_1: RecipeInput = { item_id: fixItemId(inp0.item_id), qty: inp0.qty }
    const input_2: RecipeInput | undefined = inp1
      ? { item_id: fixItemId(inp1.item_id), qty: inp1.qty }
      : undefined
    const output: RecipeInput = {
      item_id: fixItemId(out0.item_id),
      qty: out0.qty,
    }
    const existingId = findExistingRecipeId(machineId, input_1, input_2, output)
    const recipe_id = existingId ?? nextRecipeId(machineId)
    const defaultSec = DEFAULT_TIME_BY_KOREAN[r.machine_id] ?? 2
    const spec: RecipeSpec = {
      recipe_id,
      machine_id: machineId,
      input_1,
      output,
      process_time_sec: defaultSec,
    }
    if (input_2) spec.input_2 = input_2
    out.push(spec)
  }
  return out
}

export const RECIPE_SPECS_FROM_JSON: RecipeSpec[] = buildRecipeSpecs()

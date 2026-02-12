/**
 * 레시피 데이터
 * data/recipes.json + data/machines.json 기반 로드, 한글 기계명 → 내부 machine_id 매핑, 기존 recipe_id 유지
 */

import { RECIPE_SPECS_FROM_JSON } from './recipeFromJson'

/** 기계 작업 속도 기본값(초). 레시피에 process_time_sec가 없을 때 사용 */
export const DEFAULT_PROCESS_TIME_SEC = 2

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
  /** 변환 소요 시간(초). 없으면 DEFAULT_PROCESS_TIME_SEC(2초) 사용 */
  process_time_sec?: number
}

/** 레시피의 변환 시간(초). 미지정 시 DEFAULT_PROCESS_TIME_SEC 반환 */
export function getProcessTimeSec(recipe: RecipeSpec): number {
  return recipe.process_time_sec ?? DEFAULT_PROCESS_TIME_SEC
}

/** data/recipes.json + 기존 recipe_id 매핑으로 생성된 레시피 목록 */
export const RECIPE_SPECS: RecipeSpec[] = RECIPE_SPECS_FROM_JSON

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

/** 자체 생산(공장 외부) 가능 원자재. 초기값·분당 공급량 직접 입력 대상 */
export const EXTERNAL_SUPPLY_ITEM_IDS = ['오리지늄', '자수정', '페리움'] as const

export function isExternalSupplyItem(item_id: string): boolean {
  return (EXTERNAL_SUPPLY_ITEM_IDS as readonly string[]).includes(item_id)
}

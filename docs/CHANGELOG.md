# 변경 이력 (중간 정리)

## [중간 정리] — 최근 반영 사항

### 기계·경로
- **입출력 포트 넘버링**: 기계별 여러 입·출력 포트를 번호(0,1,2…)로 관리. `getMachineOutputPortNextCells`로 포트 순 다음 셀 반환, 경로 구축 시 모든 출력 포트 순서대로 시도.
- **기계 기본 레시피·입장 규칙**: 자동 = 입력 품목과 맞는 레시피 자동 선택(`getDefaultRecipeIdForInput`). 수동 = 선택 레시피의 입력과 일치할 때만 변환. 맞는 레시피 없으면 입장 불가.
- **경로 테스트 검증 수정**: `getFinalItemTypeAfterPath`가 입력 품목 기준으로 레시피 적용. 자동 시 오리지늄→오리고 크러스트 등 정상 변환, 수동 시 입력 불일치면 변환 없음.

### UI·창고
- **창고·관리 패널 모달**: 창고 및 추가 관리 패널을 별도 페이지가 아닌 모달로 표시. 툴바 「창고」 버튼으로 창고 모달 열기.
- **창고 테이블 UI**: 품목 목록을 재료 특성(원자재/가공품) 구분 + 테이블(구분|품목|수량) 형태로 표시. `getItemCategory`로 구분.

### 기계 내부 표시
- 기계 선택 시 **기계 내부** 섹션: 입력 버퍼, 출력 버퍼, 변환 시간(총/현재) 표시. (실값은 시뮬레이션 연동 시 반영 예정.)
- 레시피 스펙에 `process_time_sec`(선택) 추가.

### 데이터·구조
- **레시피**: `src/data/recipes.ts` — 기계별 레시피, `getDefaultRecipeIdForInput`, `getItemCategory`, `process_time_sec` 옵션.
- **전력**: `src/data/powerConsumption.ts` — 기계별 전력 스펙, `EQUIPMENT_KIND_TO_MACHINE_ID`.
- **모달**: `src/components/Modal.tsx` — 창고·관리 패널용 공용 모달.

### 문서
- FEATURES.md: 창고 모달, 기계 기본 레시피·입장 규칙, 기계 내부 표시, 입출력 포트 넘버링 정리.
- ROADMAP.md: Phase A/B 진행 단계 제안.

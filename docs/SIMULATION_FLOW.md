# 시뮬레이션 흐름 구조 (Phase A)

## 1. 틱 내 실행 순서 (명세 §6.2)

매 틱은 **고정된 순서**로 한 번만 실행된다.

1. **출고** — 창고 → 출고 포트 인접 “출력 셀”로 1개 배치 (출력 셀 비어 있을 때만, 매 틱 반복)
2. **컨베이어 이동** — 컨베이어 위 아이템을 “다음 셀”로 1칸 이동 (동시 이동은 충돌 없이 한 번에 반영)
3. (Phase B) 기계 입력 흡입 / 생산 / 출력 배출
4. **입고** — 입고 포트 셀의 아이템을 창고로 흡입

즉, **확인 → 이동**이 아니라 **단계별로 “확인 후 같은 단계 내에서만 이동 적용”**이다.  
한 틱 안에서는 “출고로 채워진 셀”이 같은 틱의 “컨베이어 이동”에서 바로 사용된다.

## 2. “다음 셀”과 “출고 출력 셀”의 일관성

- **경로 테스트(배치)**  
  `pathUtils.buildPathFromOutbound()`로 “출고 → 첫 컨베이어 → … → 입고/출고” 경로를 계산한다.  
  여기서 쓰는 **첫 번째 인접 셀 탐색 순서**는 `firstDeltas = [[0,1], [1,0], [0,-1], [-1,0]]` (→, ↓, ←, ↑) 이다.

- **시뮬레이션**  
  “출고가 물건을 내보내는 셀”과 “컨베이어가 다음으로 보내는 셀”이 **경로 테스트와 동일한 규칙**이어야 한다.  
  그래서 다음을 **pathUtils 한 곳**에서 재사용한다.
  - **출고 출력 셀**: `getOutboundOutputCell(layout, outbound)`  
    - 위와 **같은** `firstDeltas` 순서로 인접 셀을 보고, conveyor/flow 기계인 첫 셀을 반환.
  - **다음 셀 좌표**: `getNextCell(row, col, rotation)` (기존)
  - **다음 셀 수용 여부**: `canMoveToNextCell(layout, fromRow, fromCol, toRow, toCol)`  
    - `buildPathFromOutbound`에서 쓰는 것과 같은 조건:  
      다음이 conveyor면 “진입 방향(inputDirection)”이 (from→to) 이동 방향과 맞는지 검사.

이렇게 하면 “확인 → 이동” 순서가 아니라 **“어디가 다음 셀인지 / 그 셀이 수용하는지”를 경로와 동일한 규칙으로 정해 두고**, 시뮬은 그 결과만 사용한다.

## 3. 데이터 소스

- **셀별 아이템**: `SimulationState.cellItems` (키: `"row,col"`)
- **다음 셀/수용 여부**: `layout` + `pathUtils` (getNextCell, getEquipmentAt, canMoveToNextCell)
- **출고 출력 셀**: `pathUtils.getOutboundOutputCell(layout, outbound)` (경로와 동일 델타 순서)

## 4. 컨베이어 이동 단계 (의사코드)

```
for each conveyor eq (position row,col) with cellItems[key] present:
  next = getNextCell(row, col, eq.rotation)
  if next out of bounds → skip
  nextEq = getEquipmentAt(layout, next)
  if no nextEq or next cell occupied → skip
  if not canMoveToNextCell(layout, row, col, next.row, next.col) → skip
  → add (fromKey → toKey) to moves

resolve conflicts (one source per destination)
apply moves to cellItems (clear fromKey, set toKey)
```

이렇게 하면 “다음 컨베이어로 이동”과 “반복 출고”가 경로 테스트와 같은 규칙으로 동작한다.

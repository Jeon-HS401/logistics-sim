# 명세서–코드 정렬 (factory_simulator_v_1_작업_명세서.md)

명세서 항목과 현재 코드·데이터 구조의 매핑과 적용 단계를 정리한 문서입니다.

---

## 1. 공간 구조

| 명세 | 현재 코드 | 적용 상태 | 비고 |
|------|-----------|-----------|------|
| Zone 직사각 격자 (Z1 70×70, Z2/Z3 40×40) | `LayoutMap`: rows, cols (현재 32×32) | 부분 | 타입에 Zone/World 추가, 기본 그리드는 32×32 유지·명세 프리셋 선택 가능 |
| Cell: Empty / Conveyor / Machine / Power Provider | `PlacedEquipment.kind` + 그리드 배치 | 부분 | Power Provider 타입·스펙 추가 예정 |
| 포트는 Cell 점유 안 함(논리 접점) | 입고/출고가 1×1 셀에 배치됨 | 보완 예정 | 명세: 포트 1×3, Zone 외곽(좌/하) |
| 좌하단 원점 (x, y) | row, col (row 0 = 상단) | 문서화 | 화면은 row 0 상단 유지, 좌표 변환 필요 시 적용 |

---

## 2. 물류라인 및 창고

| 명세 | 현재 코드 | 적용 상태 | 비고 |
|------|-----------|-----------|------|
| 모든 Zone이 하나의 Warehouse 공유 | `LayoutMap.warehouseInventory` | ✅ | World.warehouse 로 추상화 가능 |
| inventory[item_id] = int | `warehouseInventory?: Partial<Record<ItemType, number>>` | ✅ | ItemType = item_id 역할 |
| 물류라인 Zone 외부(좌·하) | 없음 | Phase 1 이후 | 포트를 외곽 1×3으로 옮길 때 반영 |
| 입출력 포트 1×3, Zone 외부·내부 컨베이어 접속 | inbound/outbound 1×1 | 부분 | 타입에 Port(1×3, edge, connectCell) 추가, UI는 1×1 유지 가능 |
| 입력: 컨베이어 → 즉시 Warehouse 입고 | 테스트 흐름에서 입고 도착 시 창고 적재 | ✅ | |
| 출력: item_id 지정, 비었을 때 Warehouse 출고 | `outboundSelectedItem` | ✅ | |

---

## 3. 컨베이어

| 명세 | 현재 코드 | 적용 상태 | 비고 |
|------|-----------|-----------|------|
| 1×1, 방향 상하좌우 | 1×1, rotation + inputDirection | ✅ | 그리드에 [입력][출력] 화살표 표기 |
| 1 Cell당 아이템 1개 | 경로 테스트만, 셀별 아이템 상태 없음 | Phase 2 | tick 기반 이동 시 반영 |
| 이동 2초/칸, tick 기반 | 없음 | Phase 2 | tick_sec 0.5, 4 tick당 1칸 |
| 다음 셀 비면 이동, 차면 대기 | 경로 계산만 | Phase 2 | |
| 분기/합류/교차 불가 | 경로가 단방향 연결만 사용 | ✅ | |
| 2단계: 이동 의사결정 → 충돌 없이 적용 | 없음 | Phase 2 | |

---

## 4. 기계

| 명세 | 현재 코드 | 적용 상태 | 비고 |
|------|-----------|-----------|------|
| 회전 가능, 직사각 점유 | machine1 2×2, rotation, size | ✅ | |
| 입출력 포트 기계 내부 개념, 좌=입/우=출, 회전 시 함께 회전 | equipmentSpecs ports (inputSide 180, outputSide 0) | ✅ | |
| 정련로/분쇄기/부품가공기/성형기 3×3 입3 출3 등 | machine1만 2×2 | 확장 예정 | 기계 type_id·스펙 테이블 확장 |
| 레시피: inputs, outputs, process_time_sec | MACHINE1_TRANSFORM, MACHINE1_PROCESSING_MS | 부분 | 레시피 타입·선택 UI는 Phase 3 |
| 입출력 버퍼 50 | 없음 | Phase 2 | |
| 입력 조건 충족 → 작업 시간 → 출력 버퍼 → 배출 | 테스트에서 경로상 기계 통과 시 변환 적용 | 부분 | tick 기반 생산 흐름은 Phase 2 |

---

## 5. 전력

| 명세 | 현재 코드 | 적용 상태 | 비고 |
|------|-----------|-----------|------|
| 전력공급기 2×2, 중심 기준 12×12 범위 | 없음 | Phase 2 | PowerProvider 타입·범위 판정 |
| 기계 점유 셀 중 하나라도 범위 내면 powered | 없음 | Phase 2 | |
| 전력 없으면 생산 중단(입력 허용, 출력 중단) | 없음 | Phase 2 | |

---

## 6. 시간 모델

| 명세 | 현재 코드 | 적용 상태 | 비고 |
|------|-----------|-----------|------|
| tick_sec 0.5 | 없음 | 추가 | 상수로 정의 |
| 컨베이어 이동 주기 4 tick | 없음 | Phase 2 | |
| Tick 순서: 출고 → 컨베이어 이동 → 기계 입력 흡입 → 기계 생산 → 기계 출력 배출 → 입고 | 없음 | Phase 2 | |

---

## 7. 데이터 구조 대응

| 명세 | 현재 코드 |
|------|-----------|
| World (zones, warehouse, current_tick) | 타입 추가. Slot.layout = 단일 Zone 내용으로 해석 가능 |
| Zone (width, height, grid, conveyors, machines, power_providers, ports) | LayoutMap = 한 Zone의 격자+장비 목록. conveyors/machines/ports는 equipment[]에서 kind로 구분 |
| Machine (type_id, rect, rotation, recipe, in_buffer, out_buffer, powered, progress) | PlacedEquipment에 확장 필드 또는 별도 Machine 타입 |

---

## 8. 프로젝트 단계 대응

| 명세 Phase | 내용 | 현재 구현 |
|------------|------|-----------|
| Phase 1 | Zone 배치, 컨베이어 단방향, 창고 입출력 포트 | 배치·컨베이어·출고 품목 선택·입고 적재·출고→입고 테스트 구현. Zone/World 타입·명세 상수 추가로 정렬 |
| Phase 2 | 기계 생산 로직, 전력 범위 | tick·이동·버퍼·전력 타입/상수 준비, 로직은 미구현 |
| Phase 3 | 레시피 UI, 생산량·병목 검증 | 미구현 |
| Phase 4 | 분배기/합류기/브릿지, 다중 Zone | 미구현 |

---

## 9. 적용 작업 요약

1. **타입 확장**: World, Zone, Warehouse, Tick 상수, Port(1×3) 개념, PowerProvider. 기존 LayoutMap/PlacedEquipment 유지·호환.
2. **데이터/상수**: Zone 프리셋(Z1 70×70 등), TICK_SEC, CONVEYOR_TICKS_PER_MOVE.
3. **문서**: STRUCTURE.md에 명세서 좌표계·셀 상태·tick 순서 반영.
4. **UI**: 당분간 변경 최소화. 단일 Zone = 현재 layout 한 개로 사용. 추후 포트 1×3·외곽 배치 시 UI 확장.

이 문서는 `factory_simulator_v_1_작업_명세서.md`가 수정되면 함께 갱신합니다.

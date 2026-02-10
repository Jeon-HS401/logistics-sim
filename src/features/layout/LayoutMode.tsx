import { useState, useEffect } from 'react'
import type { LayoutMap, PlacedEquipment, GridPosition, ItemType } from '../../models/types'
import { buildPathFromOutbound, getEquipmentAt, canPlaceAt, getCoveredCellKeys } from './pathUtils'
import { EQUIPMENT_SPECS } from '../../data/equipmentSpecs'
import { ITEM_TYPES_ALL, MACHINE1_TRANSFORM } from '../../data/dummyScenario'
import './LayoutMode.css'

const TEST_STEP_MS = 400

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2
const ZOOM_STEP = 0.25
const CELL_BASE = 32

/** 컨베이어 방향: 0=→, 90=↓, 180=←, 270=↑ (도 → 화살표) */
const DEG_TO_ARROW: Record<number, string> = { 0: '→', 90: '↓', 180: '←', 270: '↑' }
const CONVEYOR_DIRECTIONS: { deg: number; label: string }[] = [
  { deg: 0, label: '→' },
  { deg: 90, label: '↓' },
  { deg: 180, label: '←' },
  { deg: 270, label: '↑' },
]

/** 컨베이어 그리드 표기: 입력(들어오는 쪽) + 출력(나가는 쪽) → e.g. "←→" 직선, "←↓" 코너 */
function getConveyorArrowLabel(eq: PlacedEquipment): string {
  const out = eq.rotation
  const inDir = eq.inputDirection ?? (out + 180) % 360
  const a = DEG_TO_ARROW[inDir] ?? '→'
  const b = DEG_TO_ARROW[out] ?? '→'
  return a === b ? a : `${a}${b}`
}

const EQUIPMENT_LABELS: Record<string, string> = {
  inbound: '입고',
  outbound: '출고',
  conveyor: '컨베이어',
  machine1: '기계1',
  storage: '보관',
  processor: '가공',
}

type Props = {
  layout: LayoutMap
  onLayoutChange: (layout: LayoutMap) => void
}

/** 1차: 입고, 출고, 컨베이어, 기계1. 추후 기계별 크기·입출력 포트 등 확장 예정. */
const KINDS: { value: PlacedEquipment['kind']; label: string }[] = [
  { value: 'inbound', label: '입고' },
  { value: 'outbound', label: '출고' },
  { value: 'conveyor', label: '컨베이어' },
  { value: 'machine1', label: '기계1' },
]

export function LayoutMode({ layout: map, onLayoutChange }: Props) {
  const [selectedKind, setSelectedKind] = useState<PlacedEquipment['kind'] | null>(null)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [conveyorDirection, setConveyorDirection] = useState(0)
  const [machine1Direction, setMachine1Direction] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [testPath, setTestPath] = useState<GridPosition[] | null>(null)
  const [testStepIndex, setTestStepIndex] = useState(0)
  const [testRunning, setTestRunning] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  /** 출고에서 시작한 테스트일 때, 경로가 입고에서 끝나면 창고에 1개 적재 */
  const [testOutboundSourceItem, setTestOutboundSourceItem] = useState<ItemType | null>(null)

  const rotationWhenPlacing =
    selectedKind === 'conveyor' ? conveyorDirection : selectedKind === 'machine1' ? machine1Direction : 0

  const selectedEquipment = selectedEquipmentId
    ? map.equipment.find((e) => e.id === selectedEquipmentId)
    : null

  /** 경로를 따라 기계1 통과 시 변환 적용한 최종 품목 */
  const getFinalItemTypeAfterPath = (path: GridPosition[], startItem: ItemType): ItemType => {
    let item = startItem
    for (const pos of path) {
      const eq = getEquipmentAt(map, pos.row, pos.col)
      if (eq?.kind === 'machine1') {
        const next = MACHINE1_TRANSFORM[item]
        if (next) item = next
      }
    }
    return item
  }

  const handleCellClick = (pos: GridPosition) => {
    if (!selectedKind) return
    const spec = EQUIPMENT_SPECS[selectedKind]
    const size = spec ? { width: spec.width, height: spec.height } : { width: 1, height: 1 }
    if (!canPlaceAt(map, pos.row, pos.col, size)) return
    const id = `eq-${Date.now()}-${pos.row}-${pos.col}`
    const rotation = rotationWhenPlacing
    const inputDirection =
      selectedKind === 'conveyor' ? (rotation + 180) % 360 : undefined
    const base = { id, kind: selectedKind, position: pos, rotation }
    const equipmentItem =
      selectedKind === 'conveyor'
        ? { ...base, inputDirection }
        : selectedKind === 'machine1' && size.width * size.height > 1
          ? { ...base, size }
          : base
    onLayoutChange({
      ...map,
      equipment: [...map.equipment, equipmentItem],
    })
  }

  const removeEquipment = (id: string) => {
    onLayoutChange({
      ...map,
      equipment: map.equipment.filter((e) => e.id !== id),
    })
  }

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))

  const runTestFlow = () => {
    setTestMessage(null)
    setTestOutboundSourceItem(null)
    const outbound = map.equipment.find((e) => e.kind === 'outbound' && e.outboundSelectedItem)
    if (!outbound?.outboundSelectedItem) {
      setTestMessage('출고 품목이 선택된 출고 장비가 없습니다. 출고를 클릭해 창고 물품을 선택하세요.')
      return
    }
    const inv = map.warehouseInventory ?? {}
    const count = inv[outbound.outboundSelectedItem] ?? 0
    if (count < 1) {
      setTestMessage(`창고에 "${outbound.outboundSelectedItem}"이(가) 없습니다. 입고로 먼저 적재하거나 창고 수량을 설정하세요.`)
      return
    }
    const path = buildPathFromOutbound(map, outbound.id)
    if (!path || path.length === 0) {
      setTestMessage('해당 출고에서 입고로 이어지는 경로가 없습니다.')
      return
    }
    onLayoutChange({
      ...map,
      warehouseInventory: {
        ...inv,
        [outbound.outboundSelectedItem]: count - 1,
      },
    })
    setTestPath(path)
    setTestStepIndex(0)
    setTestRunning(true)
    setTestOutboundSourceItem(outbound.outboundSelectedItem)
  }

  useEffect(() => {
    if (!testRunning || !testPath) return
    const id = setInterval(() => {
      setTestStepIndex((i) => {
        if (i >= testPath.length - 1) {
          setTestRunning(false)
          return i
        }
        return i + 1
      })
    }, TEST_STEP_MS)
    return () => clearInterval(id)
  }, [testRunning, testPath])

  // 출고에서 시작한 테스트가 입고 셀에서 끝나면, 기계1 변환 반영한 품목으로 창고에 1개 적재
  useEffect(() => {
    if (!testRunning && testPath && testPath.length > 0 && testOutboundSourceItem) {
      const last = testPath[testPath.length - 1]
      const eq = getEquipmentAt(map, last.row, last.col)
      if (eq?.kind === 'inbound') {
        const arrivalItem = getFinalItemTypeAfterPath(testPath, testOutboundSourceItem)
        const inv = map.warehouseInventory ?? {}
        const count = inv[arrivalItem] ?? 0
        onLayoutChange({
          ...map,
          warehouseInventory: { ...inv, [arrivalItem]: count + 1 },
        })
      }
      setTestOutboundSourceItem(null)
    }
  }, [testRunning, testPath, testOutboundSourceItem, map])

  return (
    <div className="layout-mode">
      <aside className="layout-panel-top" aria-label="기능 패널 (상단)">
        {/* 추후 상단 기능 패널 */}
      </aside>

      <div className="layout-body">
        <aside className="layout-panel-side" aria-label="기능 패널 (사이드)">
          {selectedEquipment ? (
            <div className="layout-sidebar-content">
              <div className="layout-sidebar-header">
                <p className="layout-sidebar-title">
                  {EQUIPMENT_LABELS[selectedEquipment.kind]} ({selectedEquipment.position.row}, {selectedEquipment.position.col})
                </p>
                <button
                  type="button"
                  className="layout-sidebar-close"
                  onClick={() => setSelectedEquipmentId(null)}
                  aria-label="선택 해제(닫기)"
                  title="닫기"
                >
                  ×
                </button>
              </div>
              {selectedEquipment.kind === 'outbound' && (
                <div className="layout-sidebar-field">
                  <span className="layout-sidebar-label">출고 물품(창고 선택):</span>
                  <select
                    value={selectedEquipment.outboundSelectedItem ?? ''}
                    onChange={(e) => {
                      const v = e.target.value as ItemType | ''
                      onLayoutChange({
                        ...map,
                        equipment: map.equipment.map((eq) =>
                          eq.id === selectedEquipment.id
                            ? { ...eq, outboundSelectedItem: v || undefined }
                            : eq
                        ),
                      })
                    }}
                    aria-label="출고 물품 선택"
                  >
                    <option value="">선택 안 함</option>
                    {ITEM_TYPES_ALL.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              )}
              {selectedEquipment.kind === 'conveyor' && (
                <>
                  <p className="layout-sidebar-hint layout-sidebar-hint--small">입력=들어오는 쪽, 출력=나가는 쪽. 그리드에는 [입력][출력] 화살표로 표시.</p>
                  <div className="layout-sidebar-field">
                    <span className="layout-sidebar-label">출력(나가는 쪽):</span>
                    <div className="layout-sidebar-directions">
                      {CONVEYOR_DIRECTIONS.map((d) => (
                        <button
                          key={d.deg}
                          type="button"
                          className={`layout-direction-btn ${selectedEquipment.rotation === d.deg ? 'active' : ''}`}
                          onClick={() =>
                            onLayoutChange({
                              ...map,
                              equipment: map.equipment.map((e) =>
                                e.id === selectedEquipment.id ? { ...e, rotation: d.deg } : e
                              ),
                            })
                          }
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="layout-sidebar-field">
                    <span className="layout-sidebar-label">입력(들어오는 쪽):</span>
                    <div className="layout-sidebar-directions">
                      {CONVEYOR_DIRECTIONS.map((d) => (
                        <button
                          key={d.deg}
                          type="button"
                          className={`layout-direction-btn ${(selectedEquipment.inputDirection ?? (selectedEquipment.rotation + 180) % 360) === d.deg ? 'active' : ''}`}
                          onClick={() =>
                            onLayoutChange({
                              ...map,
                              equipment: map.equipment.map((e) =>
                                e.id === selectedEquipment.id ? { ...e, inputDirection: d.deg } : e
                              ),
                            })
                          }
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {selectedEquipment.kind === 'machine1' && (
                <div className="layout-sidebar-field">
                  <span className="layout-sidebar-label">출력 방향:</span>
                  <div className="layout-sidebar-directions">
                    {CONVEYOR_DIRECTIONS.map((d) => (
                      <button
                        key={d.deg}
                        type="button"
                        className={`layout-direction-btn ${selectedEquipment.rotation === d.deg ? 'active' : ''}`}
                        onClick={() =>
                          onLayoutChange({
                            ...map,
                            equipment: map.equipment.map((e) =>
                              e.id === selectedEquipment.id ? { ...e, rotation: d.deg } : e
                            ),
                          })
                        }
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                className="layout-sidebar-remove"
                onClick={() => {
                  removeEquipment(selectedEquipment.id)
                  setSelectedEquipmentId(null)
                }}
              >
                이 장비 제거
              </button>
            </div>
          ) : (
            <>
              <p className="layout-sidebar-hint">장비를 클릭하면 속성을 편집할 수 있습니다.</p>
              <div className="layout-sidebar-warehouse">
                <p className="layout-sidebar-warehouse-title">창고 (테스트용)</p>
                <div className="layout-sidebar-warehouse-list">
                  {ITEM_TYPES_ALL.map((item) => {
                    const count = (map.warehouseInventory ?? {})[item] ?? 0
                    return (
                      <div key={item} className="layout-sidebar-warehouse-row">
                        <span>{item}</span>
                        <span>{count}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onLayoutChange({
                              ...map,
                              warehouseInventory: {
                                ...(map.warehouseInventory ?? {}),
                                [item]: count + 1,
                              },
                            })
                          }
                        >
                          +1
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </aside>

        <div className="layout-main">
          <section className="layout-toolbar">
            <span className="layout-toolbar-label">장비:</span>
            <div className="layout-toolbar-buttons">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className={selectedKind === k.value ? 'active' : ''}
                  onClick={() => setSelectedKind(selectedKind === k.value ? null : k.value)}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="layout-zoom">
              <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="축소">
                −
              </button>
              <span className="layout-zoom-value">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="확대">
                +
              </button>
            </div>
            {selectedKind === 'conveyor' && (
              <div className="layout-direction">
                <span className="layout-toolbar-label">배치 시 방향 (직선 기본, 선택 후 사이드바에서 입·출력 각각 변경 가능):</span>
                {CONVEYOR_DIRECTIONS.map((d) => (
                  <button
                    key={d.deg}
                    type="button"
                    className={`layout-direction-btn ${conveyorDirection === d.deg ? 'active' : ''}`}
                    onClick={() => setConveyorDirection(d.deg)}
                    title={`${d.deg}°`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
            {selectedKind === 'machine1' && (
              <div className="layout-direction">
                <span className="layout-toolbar-label">배치 시 출력 방향:</span>
                {CONVEYOR_DIRECTIONS.map((d) => (
                  <button
                    key={d.deg}
                    type="button"
                    className={`layout-direction-btn ${machine1Direction === d.deg ? 'active' : ''}`}
                    onClick={() => setMachine1Direction(d.deg)}
                    title={`${d.deg}°`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
            <div className="layout-test-wrap">
              <button
                type="button"
                className="layout-test-btn"
                onClick={runTestFlow}
                disabled={testRunning}
                title="출고(창고 선택 품목) → 경로 → 입고(창고 적재)"
              >
                {testRunning ? '흐름 시연 중…' : '물품 1개 흐름 (출고→입고)'}
              </button>
              {testMessage && <span className="layout-test-msg">{testMessage}</span>}
            </div>
            {selectedKind && (
              <p className="layout-hint">
                칸 클릭=배치. 배치된 장비 클릭=선택 → 사이드바에서 방향·제거.
              </p>
            )}
          </section>

          <section className="layout-grid-area">
            <div
              className="layout-grid-zoom"
              style={{ '--zoom': zoom } as React.CSSProperties}
            >
              <div
                className="layout-grid"
                style={{
                  gridTemplateRows: `repeat(${map.rows}, ${CELL_BASE}px)`,
                  gridTemplateColumns: `repeat(${map.cols}, ${CELL_BASE}px)`,
                }}
              >
                {(() => {
                  const covered = getCoveredCellKeys(map)
                  const cellKey = (r: number, c: number) => `${r},${c}`
                  const items: { key: string; row: number; col: number; rowSpan: number; colSpan: number; eq: PlacedEquipment | null }[] = []
                  for (let row = 0; row < map.rows; row++) {
                    for (let col = 0; col < map.cols; col++) {
                      if (covered.has(cellKey(row, col))) continue
                      const eq = getEquipmentAt(map, row, col)
                      const spec = eq ? EQUIPMENT_SPECS[eq.kind] : null
                      const sz = eq?.size ?? (spec ? { width: spec.width, height: spec.height } : { width: 1, height: 1 })
                      items.push({
                        key: eq ? eq.id : cellKey(row, col),
                        row,
                        col,
                        rowSpan: sz.height,
                        colSpan: sz.width,
                        eq: eq ?? null,
                      })
                    }
                  }
                  return items.map(({ key, row, col, rowSpan, colSpan, eq }) => {
                    const isTestPath =
                      testPath &&
                      testPath.some((p) => p.row >= row && p.row < row + rowSpan && p.col >= col && p.col < col + colSpan)
                    const isTestCurrentInBlock =
                      testPath &&
                      testStepIndex < testPath.length &&
                      testPath[testStepIndex].row >= row &&
                      testPath[testStepIndex].row < row + rowSpan &&
                      testPath[testStepIndex].col >= col &&
                      testPath[testStepIndex].col < col + colSpan
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        className={`layout-cell ${eq ? 'has-equipment' : ''} ${eq?.kind === 'machine1' ? 'layout-cell--machine' : ''} ${isTestPath ? 'layout-cell--test-path' : ''} ${isTestCurrentInBlock ? 'layout-cell--test-current' : ''} ${selectedEquipmentId === eq?.id ? 'layout-cell--selected' : ''}`}
                        style={{
                          gridRow: `${row + 1} / span ${rowSpan}`,
                          gridColumn: `${col + 1} / span ${colSpan}`,
                        }}
                        onClick={() =>
                          eq ? setSelectedEquipmentId(eq.id) : handleCellClick({ row, col })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            eq ? setSelectedEquipmentId(eq.id) : handleCellClick({ row, col })
                          }
                        }}
                      >
                        {eq && (
                          <span className={eq.kind === 'conveyor' ? 'layout-cell-label layout-cell-label--conveyor' : 'layout-cell-label'}>
                            {eq.kind === 'conveyor'
                              ? getConveyorArrowLabel(eq)
                              : (EQUIPMENT_LABELS[eq.kind] ?? eq.kind.slice(0, 2))}
                          </span>
                        )}
                        {isTestCurrentInBlock && <span className="layout-cell-test-dot" aria-hidden />}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </section>

          <section className="layout-footer">
            <small>배치된 장비: {map.equipment.length}개</small>
          </section>
        </div>
      </div>
    </div>
  )
}

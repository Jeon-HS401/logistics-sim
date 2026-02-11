import { useState, useEffect, useRef, useCallback } from 'react'
import type { LayoutMap, PlacedEquipment, GridPosition, ItemType } from '../../models/types'
import { buildPathFromOutbound, getEquipmentAt, canPlaceAt, canPlaceAtExcept, getCoveredCellKeys } from './pathUtils'
import { EQUIPMENT_SPECS } from '../../data/equipmentSpecs'
import { ITEM_TYPES_ALL, MACHINE1_TRANSFORM } from '../../data/dummyScenario'
import { ZONE_PRESETS, DEFAULT_ZONE_GRID } from '../../data/zonePresets'
import './LayoutMode.css'

const TEST_STEP_MS = 400

/** 컨베이어: 진입 시 이동 방향 + 진출 시 이동 방향 (예: →→ 좌→우, →↓ 좌→하단) */
const DEG_TO_ARROW: Record<number, string> = { 0: '→', 90: '↓', 180: '←', 270: '↑' }
const CONVEYOR_DIRECTIONS: { deg: number; label: string }[] = [
  { deg: 0, label: '→' },
  { deg: 90, label: '↓' },
  { deg: 180, label: '←' },
  { deg: 270, label: '↑' },
]

/** 보드 표기: 첫 글자 = 진입 시 이동 방향, 둘째 = 진출 시 이동 방향 */
function getConveyorArrowLabel(eq: PlacedEquipment): string {
  const exitDir = eq.rotation
  const enterDir = eq.inputDirection ?? exitDir
  const a = DEG_TO_ARROW[enterDir] ?? '→'
  const b = DEG_TO_ARROW[exitDir] ?? '→'
  return `${a}${b}`
}

/** 그리드 셀에 표시할 장비 명칭 (점유 공간 중앙에 표기) */
function getEquipmentDisplayName(eq: PlacedEquipment): string {
  if (eq.kind === 'conveyor') return getConveyorArrowLabel(eq)
  if (eq.kind === 'power_provider') return '전력'
  const names: Record<string, string> = {
    inbound: '입고',
    outbound: '출고',
    power_provider: '전력',
    smelter: '정련로',
    crusher: '분쇄기',
    parts_processor: '부품가공기',
    former: '성형기',
    seed_extractor: '씨앗 추출기',
    cultivator: '재배기',
    equipment_parts: '장비부품생성기',
    filler: '충진기',
    packer: '포장기',
    polisher: '연마기',
    machine1: '기계1',
  }
  return names[eq.kind] ?? eq.kind
}

/** 명세 §4.2 기초 생산 기계, §4.3 합성 생산 기계 */
const MACHINE_LIST: { value: PlacedEquipment['kind']; label: string }[] = [
  { value: 'smelter', label: '정련로 (3×3)' },
  { value: 'crusher', label: '분쇄기 (3×3)' },
  { value: 'parts_processor', label: '부품가공기 (3×3)' },
  { value: 'former', label: '성형기 (3×3)' },
  { value: 'seed_extractor', label: '씨앗 추출기 (5×5)' },
  { value: 'cultivator', label: '재배기 (5×5)' },
  { value: 'equipment_parts', label: '장비 부품 생성기 (4×6)' },
  { value: 'filler', label: '충진기 (4×6)' },
  { value: 'packer', label: '포장기 (4×6)' },
  { value: 'polisher', label: '연마기 (4×6)' },
]

type Props = {
  layout: LayoutMap
  onLayoutChange: (layout: LayoutMap) => void
}

const GRID_SIZE_OPTIONS = [
  { rows: DEFAULT_ZONE_GRID.rows, cols: DEFAULT_ZONE_GRID.cols, label: '32×32' },
  ...ZONE_PRESETS.map((z) => ({ rows: z.height, cols: z.width, label: `${z.name} ${z.width}×${z.height}` })),
]

export function LayoutMode({ layout: map, onLayoutChange }: Props) {
  const [selectedKind, setSelectedKind] = useState<PlacedEquipment['kind'] | null>(null)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [conveyorDirection, setConveyorDirection] = useState(0)
  const [machine1Direction, setMachine1Direction] = useState(0)
  const [testPath, setTestPath] = useState<GridPosition[] | null>(null)
  const [testStepIndex, setTestStepIndex] = useState(0)
  const [testRunning, setTestRunning] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testOutboundSourceItem, setTestOutboundSourceItem] = useState<ItemType | null>(null)
  const [gridZoom, setGridZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null)
  const setPanningRef = useRef<(v: boolean) => void>(() => {})
  setPanningRef.current = setIsPanning
  const dragIdRef = useRef<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const didDragRef = useRef(false)
  const DRAG_THRESHOLD = 6
  const conveyorLineStartRef = useRef<{ row: number; col: number } | null>(null)
  const conveyorLineClientRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const didConveyorLineRef = useRef(false)
  const onLayoutChangeRef = useRef(onLayoutChange)
  onLayoutChangeRef.current = onLayoutChange
  const selectedKindRef = useRef(selectedKind)
  selectedKindRef.current = selectedKind
  const conveyorDirectionRef = useRef(conveyorDirection)
  conveyorDirectionRef.current = conveyorDirection

  const isMachineKind = selectedKind != null && MACHINE_LIST.some((m) => m.value === selectedKind)
  const rotationWhenPlacing =
    selectedKind === 'conveyor' ? conveyorDirection : isMachineKind ? machine1Direction : 0
  const selectedEquipment = selectedEquipmentId
    ? map.equipment.find((e) => e.id === selectedEquipmentId)
    : null

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
    if (selectedKind === 'conveyor' && didConveyorLineRef.current) {
      didConveyorLineRef.current = false
      return
    }
    const spec = EQUIPMENT_SPECS[selectedKind]
    const size = spec ? { width: spec.width, height: spec.height } : { width: 1, height: 1 }
    if (!canPlaceAt(map, pos.row, pos.col, size)) return
    const id = `eq-${Date.now()}-${pos.row}-${pos.col}`
    const rotation = rotationWhenPlacing
    const inputDirection = selectedKind === 'conveyor' ? rotation : undefined
    const base = { id, kind: selectedKind, position: pos, rotation }
    const equipmentItem =
      selectedKind === 'conveyor'
        ? { ...base, inputDirection }
        : size.width * size.height > 1
          ? { ...base, size }
          : base
    onLayoutChange({ ...map, equipment: [...map.equipment, equipmentItem] })
  }

  const removeEquipment = (id: string) => {
    onLayoutChange({ ...map, equipment: map.equipment.filter((e) => e.id !== id) })
    setSelectedEquipmentId(null)
  }

  const moveEquipment = useCallback((id: string, newRow: number, newCol: number) => {
    const eq = map.equipment.find((e) => e.id === id)
    if (!eq) return
    const spec = EQUIPMENT_SPECS[eq.kind]
    const size = eq.size ?? (spec ? { width: spec.width, height: spec.height } : { width: 1, height: 1 })
    if (!canPlaceAtExcept(map, newRow, newCol, size, id)) return
    onLayoutChange({
      ...map,
      equipment: map.equipment.map((e) =>
        e.id === id ? { ...e, position: { row: newRow, col: newCol } } : e
      ),
    })
  }, [map, onLayoutChange])

  const moveEquipmentRef = useRef(moveEquipment)
  moveEquipmentRef.current = moveEquipment
  const mapRef = useRef(map)
  mapRef.current = map

  const handleGridSizeChange = (rows: number, cols: number) => {
    if (rows === map.rows && cols === map.cols) return
    const within = map.equipment.filter((e) => {
      const w = e.size?.width ?? 1
      const h = e.size?.height ?? 1
      return e.position.col + w <= cols && e.position.row + h <= rows
    })
    onLayoutChange({ ...map, rows, cols, equipment: within })
  }

  const runTestFlow = () => {
    setTestMessage(null)
    setTestOutboundSourceItem(null)
    const outbound = map.equipment.find((e) => e.kind === 'outbound' && e.outboundSelectedItem)
    if (!outbound?.outboundSelectedItem) {
      setTestMessage('출고 품목이 선택된 출고가 없습니다.')
      return
    }
    const inv = map.warehouseInventory ?? {}
    const count = inv[outbound.outboundSelectedItem] ?? 0
    if (count < 1) {
      setTestMessage(`창고에 "${outbound.outboundSelectedItem}"이(가) 없습니다.`)
      return
    }
    const path = buildPathFromOutbound(map, outbound.id)
    if (!path || path.length === 0) {
      setTestMessage('출고에서 입고로 이어지는 경로가 없습니다.')
      return
    }
    onLayoutChange({
      ...map,
      warehouseInventory: { ...inv, [outbound.outboundSelectedItem]: count - 1 },
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

  useEffect(() => {
    if (!testRunning && testPath?.length && testOutboundSourceItem) {
      const last = testPath[testPath.length - 1]
      const eq = getEquipmentAt(map, last.row, last.col)
      if (eq?.kind === 'inbound') {
        const arrivalItem = getFinalItemTypeAfterPath(testPath, testOutboundSourceItem)
        const inv = map.warehouseInventory ?? {}
        const count = inv[arrivalItem] ?? 0
        onLayoutChange({ ...map, warehouseInventory: { ...inv, [arrivalItem]: count + 1 } })
      }
      setTestOutboundSourceItem(null)
    }
  }, [testRunning, testPath, testOutboundSourceItem, map])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragIdRef.current || !dragStartRef.current) return
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) didDragRef.current = true
    }
    const onUp = (e: MouseEvent) => {
      const lineStart = conveyorLineStartRef.current
      if (lineStart != null && selectedKindRef.current === 'conveyor') {
        conveyorLineStartRef.current = null
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.layout-cell')
        const r = el?.getAttribute?.('data-row')
        const c = el?.getAttribute?.('data-col')
        const endRow = r != null ? parseInt(r, 10) : lineStart.row
        const endCol = c != null ? parseInt(c, 10) : lineStart.col
        const mapCur = mapRef.current
        const rotation = conveyorDirectionRef.current
        const cells: GridPosition[] = []
        if (lineStart.row === endRow) {
          const cMin = Math.min(lineStart.col, endCol)
          const cMax = Math.max(lineStart.col, endCol)
          for (let col = cMin; col <= cMax; col++) cells.push({ row: lineStart.row, col })
        } else if (lineStart.col === endCol) {
          const rMin = Math.min(lineStart.row, endRow)
          const rMax = Math.max(lineStart.row, endRow)
          for (let row = rMin; row <= rMax; row++) cells.push({ row, col: lineStart.col })
        } else {
          cells.push(lineStart)
        }
        const dir = cells.length === 1
          ? rotation
          : lineStart.row === endRow
            ? (endCol >= lineStart.col ? 0 : 180)
            : (endRow >= lineStart.row ? 270 : 90)
        const newItems: PlacedEquipment[] = []
        for (const pos of cells) {
          if (!canPlaceAt(mapCur, pos.row, pos.col, { width: 1, height: 1 })) continue
          newItems.push({
            id: `eq-${Date.now()}-${pos.row}-${pos.col}-${newItems.length}`,
            kind: 'conveyor',
            position: pos,
            rotation: dir,
            inputDirection: dir,
          })
        }
        if (newItems.length > 0) {
          onLayoutChangeRef.current({ ...mapCur, equipment: [...mapCur.equipment, ...newItems] })
          didConveyorLineRef.current = true
        }
        return
      }

      const id = dragIdRef.current
      dragIdRef.current = null
      dragStartRef.current = null
      if (id && didDragRef.current) {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.layout-cell')
        const r = el?.getAttribute?.('data-row')
        const c = el?.getAttribute?.('data-col')
        if (r != null && c != null) {
          const newRow = parseInt(r, 10)
          const newCol = parseInt(c, 10)
          const eq = mapRef.current.equipment.find((e) => e.id === id)
          if (eq && (eq.position.row !== newRow || eq.position.col !== newCol)) {
            moveEquipmentRef.current(id, newRow, newCol)
          }
        }
      }
    }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
    return () => {
    document.removeEventListener('mousemove', onMove, true)
    document.removeEventListener('mouseup', onUp, true)
    }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const start = panStartRef.current
      if (!start) return
      setPan({
        x: start.panX + e.clientX - start.clientX,
        y: start.panY + e.clientY - start.clientY,
      })
    }
    const onUp = () => {
      panStartRef.current = null
      setPanningRef.current?.(false)
    }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
    return () => {
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('mouseup', onUp, true)
    }
  }, [])

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

  return (
    <div className="layout-mode">
      {/* 좌측: 장비 패널 (컨베이어 | 기계 목록 | 전력 | 입출력 포트) + Zone 크기 */}
      <aside className="layout-panel-left">
        <header className="layout-panel-head">장비</header>
        <section className="layout-section">
          <h4 className="layout-section-title">컨베이어</h4>
          <button
            type="button"
            className={`layout-btn layout-btn--conveyor ${selectedKind === 'conveyor' ? 'active' : ''}`}
            onClick={() => setSelectedKind(selectedKind === 'conveyor' ? null : 'conveyor')}
          >
            컨베이어
          </button>
          {selectedKind === 'conveyor' && (
            <div className="layout-direction-row">
              <span className="layout-direction-label">진출 방향 (배치 시 진입=진출)</span>
              <div className="layout-direction-btns">
                {CONVEYOR_DIRECTIONS.map((d) => (
                  <button
                    key={d.deg}
                    type="button"
                    className={`layout-arrow-btn ${conveyorDirection === d.deg ? 'active' : ''}`}
                    onClick={() => setConveyorDirection(d.deg)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="layout-section">
          <h4 className="layout-section-title">기계 목록</h4>
          <ul className="layout-machine-list">
            {MACHINE_LIST.map((m) => (
              <li key={m.value}>
                <button
                  type="button"
                  className={`layout-btn layout-btn--machine ${selectedKind === m.value ? 'active' : ''}`}
                  onClick={() => setSelectedKind(selectedKind === m.value ? null : m.value)}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
          {isMachineKind && (
            <div className="layout-direction-row">
              <span className="layout-direction-label">배치(출력) 방향</span>
              <div className="layout-direction-btns">
                {CONVEYOR_DIRECTIONS.map((d) => (
                  <button
                    key={d.deg}
                    type="button"
                    className={`layout-arrow-btn ${machine1Direction === d.deg ? 'active' : ''}`}
                    onClick={() => setMachine1Direction(d.deg)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="layout-section">
          <h4 className="layout-section-title">전력</h4>
          <button
            type="button"
            className={`layout-btn layout-btn--power ${selectedKind === 'power_provider' ? 'active' : ''}`}
            onClick={() => setSelectedKind(selectedKind === 'power_provider' ? null : 'power_provider')}
          >
            전력공급기
          </button>
        </section>
        <section className="layout-section">
          <h4 className="layout-section-title">입출력 포트</h4>
          <div className="layout-port-btns">
            <button
              type="button"
              className={`layout-btn layout-btn--inbound ${selectedKind === 'inbound' ? 'active' : ''}`}
              onClick={() => setSelectedKind(selectedKind === 'inbound' ? null : 'inbound')}
            >
              입고
            </button>
            <button
              type="button"
              className={`layout-btn layout-btn--outbound ${selectedKind === 'outbound' ? 'active' : ''}`}
              onClick={() => setSelectedKind(selectedKind === 'outbound' ? null : 'outbound')}
            >
              출고
            </button>
          </div>
        </section>
        <section className="layout-section">
          <h4 className="layout-section-title">Zone 크기</h4>
          <div className="layout-zone-size-btns">
            {GRID_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={`layout-zone-btn ${map.rows === opt.rows && map.cols === opt.cols ? 'active' : ''}`}
                onClick={() => handleGridSizeChange(opt.rows, opt.cols)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>
      </aside>

      {/* 중앙: Zone 그리드 (100% 채움, 1fr 셀) */}
      <div className="layout-center">
        <div className="layout-toolbar">
          <div className="layout-zoom-controls">
            <button
              type="button"
              className="layout-zoom-btn"
              onClick={() => setGridZoom((z) => Math.max(0.25, z - 0.25))}
              title="축소"
              aria-label="축소"
            >
              −
            </button>
            <span className="layout-zoom-value">{Math.round(gridZoom * 100)}%</span>
            <button
              type="button"
              className="layout-zoom-btn"
              onClick={() => setGridZoom((z) => Math.min(2, z + 0.25))}
              title="확대"
              aria-label="확대"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="layout-test-btn"
            onClick={runTestFlow}
            disabled={testRunning}
          >
            {testRunning ? '흐름 시연 중…' : '물품 1개 흐름 (출고→입고)'}
          </button>
          {testMessage && <span className="layout-test-msg">{testMessage}</span>}
          {selectedKind && (
            <span className="layout-hint">
              {selectedKind === 'conveyor'
                ? '칸 클릭=1개 배치 · 빈 칸에서 드래그=직선(가로/세로) 연속 배치 · 장비 클릭=선택 · 장비 드래그=이동'
                : '칸 클릭=배치 · 장비 클릭=선택 · 장비 드래그=이동'}
            </span>
          )}
        </div>
        <div className="layout-zone-area">
          <div
            className={`layout-zone-zoom-wrap ${isPanning ? 'layout-zone-zoom-wrap--panning' : ''}`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${gridZoom})`,
              transformOrigin: 'center center',
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return
              if ((e.target as HTMLElement).closest?.('.layout-cell')) return
              panStartRef.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                panX: pan.x,
                panY: pan.y,
              }
              setIsPanning(true)
            }}
          >
          <div
            className="layout-zone-grid-container"
            style={{
              '--zone-rows': map.rows,
              '--zone-cols': map.cols,
              gridTemplateRows: `24px repeat(${map.rows}, 1fr)`,
              gridTemplateColumns: `24px repeat(${map.cols}, 1fr)`,
            } as React.CSSProperties}
          >
            <div className="layout-zone-corner" style={{ gridRow: 1, gridColumn: 1 }} />
            <div
              className="layout-axis-x-wrap"
              style={{ gridRow: 1, gridColumn: `2 / span ${map.cols}` }}
            >
              {Array.from({ length: map.cols }, (_, i) => (
                <span key={`x-${i}`} className="layout-axis-x">{i}</span>
              ))}
            </div>
            {Array.from({ length: map.rows }, (_, i) => {
              const y = map.rows - 1 - i
              return (
                <span key={`y-${y}`} className="layout-axis-y" style={{ gridRow: i + 2, gridColumn: 1 }}>
                  {y}
                </span>
              );})}
            <div
              className="layout-grid-inner"
              style={{
                gridRow: `2 / ${map.rows + 2}`,
                gridColumn: `2 / ${map.cols + 2}`,
                gridTemplateRows: `repeat(${map.rows}, 1fr)`,
                gridTemplateColumns: `repeat(${map.cols}, 1fr)`,
              }}
            >
              {items.map(({ key, row, col, rowSpan, colSpan, eq }) => {
                const isTestPath =
                  testPath?.some((p) => p.row >= row && p.row < row + rowSpan && p.col >= col && p.col < col + colSpan)
                const isTestCurrent =
                  testPath &&
                  testStepIndex < testPath.length &&
                  testPath[testStepIndex].row >= row &&
                  testPath[testStepIndex].row < row + rowSpan &&
                  testPath[testStepIndex].col >= col &&
                  testPath[testStepIndex].col < col + colSpan
                const isInPowerRange =
                  selectedEquipment?.kind === 'power_provider' &&
                  (() => {
                    const r0 = selectedEquipment.position.row
                    const c0 = selectedEquipment.position.col
                    return row >= r0 - 5 && row <= r0 + 6 && col >= c0 - 5 && col <= c0 + 6
                  })()
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    className={`layout-cell ${eq ? 'has-equipment layout-cell--border' : ''} ${eq ? `layout-cell--${eq.kind}` : ''} ${isTestPath ? 'layout-cell--test-path' : ''} ${isTestCurrent ? 'layout-cell--test-current' : ''} ${selectedEquipmentId === eq?.id ? 'layout-cell--selected' : ''} ${eq ? 'layout-cell--draggable' : ''} ${isInPowerRange ? 'layout-cell--power-range' : ''}`}
                    style={{
                      gridRow: `${map.rows - row - rowSpan + 1} / span ${rowSpan}`,
                      gridColumn: `${col + 1} / span ${colSpan}`,
                    }}
                    data-row={row}
                    data-col={col}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return
                      if (eq) {
                        dragIdRef.current = eq.id
                        dragStartRef.current = { x: e.clientX, y: e.clientY }
                        didDragRef.current = false
                      } else if (selectedKind === 'conveyor') {
                        conveyorLineStartRef.current = { row, col }
                        conveyorLineClientRef.current = { x: e.clientX, y: e.clientY }
                      }
                    }}
                    onClick={() => {
                      if (didDragRef.current) {
                        didDragRef.current = false
                        return
                      }
                      eq ? setSelectedEquipmentId(eq.id) : handleCellClick({ row, col })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        eq ? setSelectedEquipmentId(eq.id) : handleCellClick({ row, col })
                      }
                    }}
                  >
                    {eq && (
                      <span className="layout-cell-label">
                        {getEquipmentDisplayName(eq)}
                      </span>
                    )}
                    {isTestCurrent && <span className="layout-cell-dot" aria-hidden />}
                  </div>
                )
              })}
            </div>
          </div>
          </div>
        </div>
        <footer className="layout-footer">장비 {map.equipment.length}개</footer>
      </div>

      {/* 우측: 창고(숫자 입력) + 선택 장비 속성 */}
      <aside className="layout-panel-right">
        <section className="layout-warehouse">
          <header className="layout-panel-head">창고 (Warehouse)</header>
          <p className="layout-warehouse-desc">품목별 재고 수량 입력</p>
          <div className="layout-warehouse-list">
            {ITEM_TYPES_ALL.map((item) => {
              const count = (map.warehouseInventory ?? {})[item] ?? 0
              return (
                <div key={item} className="layout-warehouse-row">
                  <label className="layout-warehouse-label">{item}</label>
                  <input
                    type="number"
                    min={0}
                    value={count}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      onLayoutChange({
                        ...map,
                        warehouseInventory: {
                          ...(map.warehouseInventory ?? {}),
                          [item]: Number.isNaN(v) ? 0 : Math.max(0, v),
                        },
                      })
                    }}
                    className="layout-warehouse-input"
                  />
                </div>
              )
            })}
          </div>
        </section>
        <section className="layout-props">
          <header className="layout-panel-head">선택 장비</header>
          {selectedEquipment ? (
            <div className="layout-props-content">
              <div className="layout-props-header">
                <span className="layout-props-title">
                  {getEquipmentDisplayName(selectedEquipment)} (y={selectedEquipment.position.row}, x={selectedEquipment.position.col})
                </span>
                <button
                  type="button"
                  className="layout-close-btn"
                  onClick={() => setSelectedEquipmentId(null)}
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
              {selectedEquipment.kind === 'outbound' && (
                <div className="layout-field">
                  <label className="layout-field-label">출고 품목</label>
                  <select
                    value={selectedEquipment.outboundSelectedItem ?? ''}
                    onChange={(e) => {
                      const v = (e.target.value || undefined) as ItemType | undefined
                      onLayoutChange({
                        ...map,
                        equipment: map.equipment.map((eq) =>
                          eq.id === selectedEquipment.id ? { ...eq, outboundSelectedItem: v } : eq
                        ),
                      })
                    }}
                  >
                    <option value="">선택 안 함</option>
                    {ITEM_TYPES_ALL.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              )}
              {(selectedEquipment.kind === 'conveyor' || MACHINE_LIST.some((m) => m.value === selectedEquipment.kind)) && (
                <div className="layout-field">
                  <span className="layout-field-label">{selectedEquipment.kind === 'conveyor' ? '진출(이동 방향)' : '출력 방향'}</span>
                  <div className="layout-direction-btns">
                    {CONVEYOR_DIRECTIONS.map((d) => (
                      <button
                        key={d.deg}
                        type="button"
                        className={`layout-arrow-btn ${selectedEquipment.rotation === d.deg ? 'active' : ''}`}
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
                  {selectedEquipment.kind === 'conveyor' && (
                    <div className="layout-direction-btns">
                      <span className="layout-direction-label">진입(이동 방향)</span>
                      {CONVEYOR_DIRECTIONS.map((d) => (
                        <button
                          key={d.deg}
                          type="button"
                          className={`layout-arrow-btn ${(selectedEquipment.inputDirection ?? selectedEquipment.rotation) === d.deg ? 'active' : ''}`}
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
                  )}
                </div>
              )}
              <button type="button" className="layout-remove-btn" onClick={() => removeEquipment(selectedEquipment.id)}>
                장비 제거
              </button>
            </div>
          ) : (
            <p className="layout-props-hint">그리드에서 장비를 클릭하면 속성을 편집할 수 있습니다.</p>
          )}
        </section>
      </aside>
    </div>
  )
}

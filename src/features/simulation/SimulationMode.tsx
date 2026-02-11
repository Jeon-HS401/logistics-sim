import { useState, useRef, useEffect, useCallback } from 'react'
import type { LayoutMap, SimulationState } from '../../models/types'
import { TICK_SEC } from '../../models/types'
import { createInitialSimulationState, runOneTick } from './simulationEngine'
import { getEquipmentAt, getCoveredCellKeys } from '../layout/pathUtils'
import { EQUIPMENT_SPECS } from '../../data/equipmentSpecs'
import type { PlacedEquipment } from '../../models/types'
import { getProcessTimeSec, getRecipeByRecipeId, getRecipeItemIds, getItemCategory } from '../../data/recipes'
import './SimulationMode.css'

const cellKey = (row: number, col: number) => `${row},${col}`

const ARROW_BY_DEG: Record<number, string> = { 0: '→', 90: '↓', 180: '←', 270: '↑' }
function getConveyorArrow(deg: number): string {
  const d = ((Math.round(deg / 90) % 4) * 90 + 360) % 360
  return ARROW_BY_DEG[d] ?? '→'
}

/** 그리드 셀에 표시할 장비 명칭 (배치 화면과 동일한 통합 라벨) */
function getEquipmentDisplayName(eq: PlacedEquipment): string {
  if (eq.kind === 'conveyor') return getConveyorArrow(eq.inputDirection ?? eq.rotation ?? 0)
  if (eq.kind === 'power_provider') return '전력'
  const names: Record<string, string> = {
    inbound: '입고',
    outbound: '출고',
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

/** 포트 있는 기계 여부 (전력/버퍼 표시 대상) */
function isFlowMachine(kind: string): boolean {
  return EQUIPMENT_SPECS[kind as keyof typeof EQUIPMENT_SPECS]?.ports != null
}

type Props = {
  layout: LayoutMap
}

type SimGridItem = { key: string; row: number; col: number; rowSpan: number; colSpan: number; eq: PlacedEquipment | null }

export function SimulationMode({ layout }: Props) {
  const defaultState = useCallback(
    () => createInitialSimulationState(layout),
    [layout]
  )
  const [simState, setSimState] = useState<SimulationState>(defaultState)
  const [isRunning, setIsRunning] = useState(false)
  const [selectedSimEquipmentId, setSelectedSimEquipmentId] = useState<string | null>(null)
  const [selectedStatsItemId, setSelectedStatsItemId] = useState<string | null>(null)
  const [gridZoom, setGridZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null)

  useEffect(() => {
    setSimState(defaultState())
    setSelectedSimEquipmentId(null)
  }, [defaultState])

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
      setIsPanning(false)
    }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
    return () => {
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('mouseup', onUp, true)
    }
  }, [])

  useEffect(() => {
    if (!isRunning) return
    intervalRef.current = setInterval(() => {
      setSimState((prev) => runOneTick(layout, prev))
    }, TICK_SEC * 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [isRunning, layout])

  const handleStep = () => {
    setSimState((prev) => runOneTick(layout, prev))
  }

  const handleReset = () => {
    setSimState(defaultState())
    setIsRunning(false)
    setSelectedSimEquipmentId(null)
  }

  const rows = layout.rows
  const cols = layout.cols
  const covered = getCoveredCellKeys(layout)
  const items: SimGridItem[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (covered.has(cellKey(row, col))) continue
      const eq = getEquipmentAt(layout, row, col)
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

  const selectedEq = selectedSimEquipmentId ? layout.equipment.find((e) => e.id === selectedSimEquipmentId) : null
  const selectedMachineState = selectedSimEquipmentId ? simState.machineStates[selectedSimEquipmentId] : null

  const elapsedMin = (simState.currentTick * TICK_SEC) / 60

  return (
    <div className="simulation-mode">
      <header className="simulation-top">
        <section className="simulation-header">
          <h2>시뮬레이션</h2>
          <p className="simulation-desc">
            배치된 레이아웃 기준으로 출고·컨베이어·기계·입고가 동작합니다.
          </p>
        </section>
        <section className="simulation-controls">
          <div className="simulation-controls-row">
            <button
              type="button"
              className="simulation-btn simulation-btn--play"
              onClick={() => setIsRunning((v) => !v)}
              disabled={layout.equipment.length === 0}
            >
              {isRunning ? '일시정지' : '재생'}
            </button>
            <button
              type="button"
              className="simulation-btn"
              onClick={handleStep}
              disabled={isRunning || layout.equipment.length === 0}
            >
              1 tick
            </button>
            <button type="button" className="simulation-btn" onClick={handleReset}>
              초기화
            </button>
          </div>
          <p className="simulation-tick">Tick: {simState.currentTick}</p>
        </section>
      </header>

      <div className="simulation-main">
        <div className="simulation-grid-toolbar">
          <div className="simulation-zoom-controls">
            <button
              type="button"
              className="simulation-zoom-btn"
              onClick={() => setGridZoom((z) => Math.max(0.25, z - 0.25))}
              title="축소"
              aria-label="축소"
            >
              −
            </button>
            <span className="simulation-zoom-value">{Math.round(gridZoom * 100)}%</span>
            <button
              type="button"
              className="simulation-zoom-btn"
              onClick={() => setGridZoom((z) => Math.min(2, z + 0.25))}
              title="확대"
              aria-label="확대"
            >
              +
            </button>
          </div>
        </div>
        <section
          className={`simulation-grid-area ${isPanning ? 'simulation-grid-area--panning' : ''}`}
          onMouseDown={(e) => {
            if (e.button !== 0) return
            if ((e.target as HTMLElement).closest?.('.simulation-cell')) return
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
            className="simulation-grid-wrap"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${gridZoom})`,
              transformOrigin: 'center center',
            }}
          >
            <div
              className="simulation-grid"
              style={{
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
              }}
            >
          {items.map(({ key, row, col, rowSpan, colSpan, eq }) => {
            const isUnpowered =
              eq && isFlowMachine(eq.kind) && simState.machineStates[eq.id] && !simState.machineStates[eq.id]!.powered
            const isSelected = eq?.id === selectedSimEquipmentId
            return (
              <div
                key={key}
                role={eq ? 'button' : undefined}
                tabIndex={eq ? 0 : undefined}
                className={`simulation-cell ${eq ? `simulation-cell--${eq.kind}` : ''} ${isUnpowered ? 'simulation-cell--unpowered' : ''} ${isSelected ? 'simulation-cell--selected' : ''}`}
                style={{
                  gridRow: `${row + 1} / span ${rowSpan}`,
                  gridColumn: `${col + 1} / span ${colSpan}`,
                }}
                onClick={() => eq && setSelectedSimEquipmentId((id) => (id === eq.id ? null : eq.id))}
                onKeyDown={(e) => {
                  if (eq && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setSelectedSimEquipmentId((id) => (id === eq.id ? null : eq.id))
                  }
                }}
              >
                <div
                  className="simulation-cell-items"
                  style={{
                    display: 'grid',
                    gridTemplateRows: `repeat(${rowSpan}, 1fr)`,
                    gridTemplateColumns: `repeat(${colSpan}, 1fr)`,
                  }}
                >
                  {Array.from({ length: rowSpan * colSpan }, (_, i) => {
                    const dr = Math.floor(i / colSpan)
                    const dc = i % colSpan
                    const r = row + dr
                    const c = col + dc
                    const k = cellKey(r, c)
                    const itemId = simState.cellItems[k]
                    return (
                      <div key={k} className="simulation-cell-inner">
                        {itemId ? (
                          <span className="simulation-cell-item" title={`품목: ${itemId}`}>
                            {itemId}
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                {eq ? <span className="simulation-cell-label">{getEquipmentDisplayName(eq)}</span> : null}
              </div>
            )
          })}
            </div>
          </div>
        </section>
      </div>

      <aside className="simulation-panel">
      {selectedEq && selectedMachineState && (
        <section className="simulation-machine-detail" aria-label="선택한 기계 상태">
          <h3 className="simulation-machine-detail-title">
            {getEquipmentDisplayName(selectedEq)} (시뮬 중 상태)
          </h3>
          <div className="simulation-machine-detail-row">
            <span className="simulation-machine-detail-label">전력</span>
            <span className="simulation-machine-detail-value">
              {selectedMachineState.powered ? '공급됨' : '미공급'}
            </span>
          </div>
          <div className="simulation-machine-detail-row">
            <span className="simulation-machine-detail-label">입력 버퍼</span>
            <span className="simulation-machine-detail-value">
              {Object.entries(selectedMachineState.inBuffer ?? {})
                .filter(([, n]) => (n ?? 0) > 0)
                .map(([id, n]) => `${id}: ${n}`)
                .join(', ') || '비어 있음'}
            </span>
          </div>
          <div className="simulation-machine-detail-row">
            <span className="simulation-machine-detail-label">출력 버퍼</span>
            <span className="simulation-machine-detail-value">
              {Object.entries(selectedMachineState.outBuffer ?? {})
                .filter(([, n]) => (n ?? 0) > 0)
                .map(([id, n]) => `${id}: ${n}`)
                .join(', ') || '비어 있음'}
            </span>
          </div>
          <div className="simulation-machine-detail-row">
            <span className="simulation-machine-detail-label">변환 진행</span>
            <span className="simulation-machine-detail-value">
              {(() => {
                const recipe = selectedMachineState.currentRecipeId
                  ? getRecipeByRecipeId(selectedMachineState.currentRecipeId)
                  : null
                const totalSec = recipe ? getProcessTimeSec(recipe) : 0
                const cur = selectedMachineState.progressSec
                if (totalSec <= 0) return `${cur.toFixed(1)}초`
                return `${cur.toFixed(1)} / ${totalSec}초`
              })()}
            </span>
          </div>
          <button
            type="button"
            className="simulation-btn simulation-machine-detail-close"
            onClick={() => setSelectedSimEquipmentId(null)}
          >
            닫기
          </button>
        </section>
      )}

        <section className="simulation-stats-panel" aria-label="관리 패널">
          <h3>관리 패널</h3>
          <p className="simulation-stats-hint">품목을 클릭하면 세부 정보를 볼 수 있습니다.</p>
          <div className="simulation-stats-table-wrap">
            <table className="simulation-stats-table simulation-stats-table--compact">
              <thead>
                <tr>
                  <th className="simulation-stats-th">품목</th>
                  <th className="simulation-stats-th simulation-stats-th--num">분당 생산</th>
                  <th className="simulation-stats-th simulation-stats-th--num">분당 소비</th>
                </tr>
              </thead>
              <tbody>
                {[...getRecipeItemIds()]
                  .sort((a, b) => {
                    const catA = getItemCategory(a)
                    const catB = getItemCategory(b)
                    if (catA !== catB) return catA === '원자재' ? -1 : 1
                    return a.localeCompare(b)
                  })
                  .map((itemId) => {
                    const s = simState.stats
                    const produced = (s?.produced?.[itemId] ?? 0)
                    const consumed = (s?.consumed?.[itemId] ?? 0)
                    const externalSupply = (s?.externalSupply?.[itemId] ?? 0)
                    const totalProduced = produced + externalSupply
                    const prodPerMin = elapsedMin > 0 ? totalProduced / elapsedMin : 0
                    const consPerMin = elapsedMin > 0 ? consumed / elapsedMin : 0
                    const format = (n: number) => (n % 1 !== 0 ? n.toFixed(1) : String(n))
                    const isSelected = selectedStatsItemId === itemId
                    return (
                      <tr
                        key={itemId}
                        className={`simulation-stats-tr ${isSelected ? 'simulation-stats-tr--selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedStatsItemId((id) => (id === itemId ? null : itemId))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedStatsItemId((id) => (id === itemId ? null : itemId))
                          }
                        }}
                      >
                        <td className="simulation-stats-td">{itemId}</td>
                        <td className="simulation-stats-td simulation-stats-td--num">
                          {elapsedMin > 0 ? `${format(prodPerMin)}/분` : '—'}
                        </td>
                        <td className="simulation-stats-td simulation-stats-td--num">
                          {elapsedMin > 0 ? `${format(consPerMin)}/분` : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {selectedStatsItemId && (() => {
            const itemId = selectedStatsItemId
            const stock = simState.warehouse[itemId] ?? 0
            const s = simState.stats
            const produced = (s?.produced?.[itemId] ?? 0)
            const consumed = (s?.consumed?.[itemId] ?? 0)
            const outbound = (s?.outbound?.[itemId] ?? 0)
            const inbound = (s?.inbound?.[itemId] ?? 0)
            const externalSupply = (s?.externalSupply?.[itemId] ?? 0)
            const totalProduced = produced + externalSupply
            const prodPerMin = elapsedMin > 0 ? totalProduced / elapsedMin : 0
            const consPerMin = elapsedMin > 0 ? consumed / elapsedMin : 0
            const category = getItemCategory(itemId)
            const format = (n: number) => (n % 1 !== 0 ? n.toFixed(1) : String(n))
            return (
              <div className="simulation-stats-detail">
                <h4 className="simulation-stats-detail-title">{itemId} 세부</h4>
                <dl className="simulation-stats-detail-list">
                  <div className="simulation-stats-detail-row">
                    <dt>구분</dt>
                    <dd>{category}</dd>
                  </div>
                  <div className="simulation-stats-detail-row">
                    <dt>현재 재고</dt>
                    <dd>{format(stock)}</dd>
                  </div>
                  <div className="simulation-stats-detail-row">
                    <dt>누적 생산</dt>
                    <dd>{format(totalProduced)}</dd>
                  </div>
                  <div className="simulation-stats-detail-row">
                    <dt>누적 소비</dt>
                    <dd>{format(consumed)}</dd>
                  </div>
                  <div className="simulation-stats-detail-row">
                    <dt>누적 출고</dt>
                    <dd>{format(outbound)}</dd>
                  </div>
                  <div className="simulation-stats-detail-row">
                    <dt>누적 입고</dt>
                    <dd>{format(inbound)}</dd>
                  </div>
                  <div className="simulation-stats-detail-row">
                    <dt>분당 생산</dt>
                    <dd>{elapsedMin > 0 ? `${format(prodPerMin)}/분` : '—'}</dd>
                  </div>
                  <div className="simulation-stats-detail-row">
                    <dt>분당 소비</dt>
                    <dd>{elapsedMin > 0 ? `${format(consPerMin)}/분` : '—'}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="simulation-btn simulation-stats-detail-close"
                  onClick={() => setSelectedStatsItemId(null)}
                >
                  닫기
                </button>
              </div>
            )
          })()}
        </section>
      </aside>
    </div>
  )
}

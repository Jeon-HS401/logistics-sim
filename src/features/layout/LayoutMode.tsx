import { useState, useEffect } from 'react'
import type { LayoutMap, PlacedEquipment, GridPosition } from '../../models/types'
import { buildPathFromInbound } from './pathUtils'
import './LayoutMode.css'

const TEST_STEP_MS = 400

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2
const ZOOM_STEP = 0.25
const CELL_BASE = 32

/** 컨베이어 이동 방향: 0=→, 90=↓, 180=←, 270=↑ (시뮬레이션에서 연결로 인지) */
const CONVEYOR_DIRECTIONS: { deg: number; label: string }[] = [
  { deg: 0, label: '→' },
  { deg: 90, label: '↓' },
  { deg: 180, label: '←' },
  { deg: 270, label: '↑' },
]

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
  const [conveyorDirection, setConveyorDirection] = useState(0)
  const [machine1Direction, setMachine1Direction] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [testPath, setTestPath] = useState<GridPosition[] | null>(null)
  const [testStepIndex, setTestStepIndex] = useState(0)
  const [testRunning, setTestRunning] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const rotationWhenPlacing =
    selectedKind === 'conveyor' ? conveyorDirection : selectedKind === 'machine1' ? machine1Direction : 0

  const handleCellClick = (pos: GridPosition) => {
    if (!selectedKind) return
    const id = `eq-${Date.now()}-${pos.row}-${pos.col}`
    const rotation = rotationWhenPlacing
    const inputDirection =
      selectedKind === 'conveyor' ? (rotation + 180) % 360 : undefined
    const equipmentItem =
      selectedKind === 'conveyor'
        ? { id, kind: selectedKind, position: pos, rotation, inputDirection }
        : { id, kind: selectedKind, position: pos, rotation }
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

  const cycleConveyorOutput = (eq: PlacedEquipment) => {
    const nextRotation = (eq.rotation + 90) % 360
    onLayoutChange({
      ...map,
      equipment: map.equipment.map((e) =>
        e.id === eq.id ? { ...e, rotation: nextRotation } : e
      ),
    })
  }

  const cycleConveyorInput = (eq: PlacedEquipment) => {
    const current = eq.inputDirection ?? (eq.rotation + 180) % 360
    const nextInput = (current + 90) % 360
    onLayoutChange({
      ...map,
      equipment: map.equipment.map((e) =>
        e.id === eq.id ? { ...e, inputDirection: nextInput } : e
      ),
    })
  }

  const cycleMachine1Direction = (eq: PlacedEquipment) => {
    const nextRotation = (eq.rotation + 90) % 360
    onLayoutChange({
      ...map,
      equipment: map.equipment.map((e) =>
        e.id === eq.id ? { ...e, rotation: nextRotation } : e
      ),
    })
  }

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))

  const runTestFlow = () => {
    setTestMessage(null)
    const path = buildPathFromInbound(map)
    if (!path) {
      setTestMessage('입고가 없거나, 입고→컨베이어/기계1→출고 연결 경로가 없습니다.')
      return
    }
    setTestPath(path)
    setTestStepIndex(0)
    setTestRunning(true)
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

  return (
    <div className="layout-mode">
      <aside className="layout-panel-top" aria-label="기능 패널 (상단)">
        {/* 추후 상단 기능 패널 */}
      </aside>

      <div className="layout-body">
        <aside className="layout-panel-side" aria-label="기능 패널 (사이드)">
          {/* 추후 사이드 기능 패널 */}
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
                <span className="layout-toolbar-label">출력(내보내는 쪽):</span>
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
                <span className="layout-toolbar-label layout-toolbar-label--hint">(클릭=출력, 우클릭=입력/방향전환)</span>
              </div>
            )}
            {selectedKind === 'machine1' && (
              <div className="layout-direction">
                <span className="layout-toolbar-label">출력(내보내는 쪽):</span>
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
              >
                {testRunning ? '흐름 시연 중…' : '물품 1개 흐름'}
              </button>
              {testMessage && <span className="layout-test-msg">{testMessage}</span>}
            </div>
            {selectedKind && (
              <p className="layout-hint">
                {selectedKind === 'conveyor'
                  ? '칸 클릭=배치. 컨베이어: 클릭=출력 방향, 우클릭=입력 방향(방향전환).'
                  : selectedKind === 'machine1'
                    ? '기계1: 출력 방향 선택 후 배치. 배치된 기계1 클릭=출력 방향 순환.'
                    : '칸을 클릭해 배치, 배치된 칸 클릭 시 제거.'}
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
                {Array.from({ length: map.rows * map.cols }, (_, i) => {
                  const row = Math.floor(i / map.cols)
                  const col = i % map.cols
                  const eq = map.equipment.find(
                    (e) => e.position.row === row && e.position.col === col
                  )
                  const isTestCurrent =
                    testPath &&
                    testStepIndex < testPath.length &&
                    testPath[testStepIndex].row === row &&
                    testPath[testStepIndex].col === col
                  const isTestPath =
                    testPath &&
                    testPath.some((p) => p.row === row && p.col === col)
                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      className={`layout-cell ${eq ? 'has-equipment' : ''} ${isTestPath ? 'layout-cell--test-path' : ''} ${isTestCurrent ? 'layout-cell--test-current' : ''}`}
                      onClick={() =>
                        eq
                          ? eq.kind === 'conveyor'
                            ? cycleConveyorOutput(eq)
                            : eq.kind === 'machine1'
                              ? cycleMachine1Direction(eq)
                              : removeEquipment(eq.id)
                          : handleCellClick({ row, col })
                      }
                      onContextMenu={(e) => {
                        e.preventDefault()
                        if (eq?.kind === 'conveyor') cycleConveyorInput(eq)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          eq
                            ? eq.kind === 'conveyor'
                              ? cycleConveyorOutput(eq)
                              : eq.kind === 'machine1'
                                ? cycleMachine1Direction(eq)
                                : removeEquipment(eq.id)
                            : handleCellClick({ row, col })
                        }
                      }}
                    >
                      {eq && (
                        <span className={`layout-cell-label ${eq.kind === 'conveyor' || eq.kind === 'machine1' ? 'layout-cell-label--conveyor' : ''}`}>
                          {eq.kind === 'conveyor' || eq.kind === 'machine1'
                            ? (CONVEYOR_DIRECTIONS.find((d) => d.deg === eq.rotation)?.label ?? '→')
                            : (EQUIPMENT_LABELS[eq.kind] ?? eq.kind.slice(0, 2))}
                        </span>
                      )}
                      {isTestCurrent && <span className="layout-cell-test-dot" aria-hidden />}
                    </div>
                  )
                })}
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

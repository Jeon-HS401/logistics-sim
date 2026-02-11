import { useState, useRef, useEffect, useCallback } from 'react'
import type { LayoutMap, SimulationState } from '../../models/types'
import { TICK_SEC } from '../../models/types'
import { createInitialSimulationState, runOneTick } from './simulationEngine'
import { getEquipmentAt } from '../layout/pathUtils'
import { EQUIPMENT_SPECS } from '../../data/equipmentSpecs'
import type { PlacedEquipment } from '../../models/types'
import './SimulationMode.css'

const cellKey = (row: number, col: number) => `${row},${col}`

/** 장비의 중앙 셀 키 목록. 1×1은 해당 칸, 2×2·4×6 등은 중앙 2×2(4칸). */
function getEquipmentCenterCellKeys(eq: PlacedEquipment): Set<string> {
  const width = eq.size?.width ?? EQUIPMENT_SPECS[eq.kind]?.width ?? 1
  const height = eq.size?.height ?? EQUIPMENT_SPECS[eq.kind]?.height ?? 1
  const r0 = eq.position.row
  const c0 = eq.position.col
  const set = new Set<string>()
  if (width <= 2 && height <= 2) {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) set.add(cellKey(r0 + r, c0 + c))
    }
    return set
  }
  const startRow = Math.ceil((height - 2) / 2)
  const startCol = Math.ceil((width - 2) / 2)
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      set.add(cellKey(r0 + startRow + dr, c0 + startCol + dc))
    }
  }
  return set
}

type Props = {
  layout: LayoutMap
}

export function SimulationMode({ layout }: Props) {
  const defaultState = useCallback(
    () => createInitialSimulationState(layout),
    [layout]
  )
  const [simState, setSimState] = useState<SimulationState>(defaultState)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setSimState(defaultState())
  }, [defaultState])

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
  }

  const rows = layout.rows
  const cols = layout.cols
  const centerCellsByEqId = new Map<string, Set<string>>()
  for (const eq of layout.equipment) {
    centerCellsByEqId.set(eq.id, getEquipmentCenterCellKeys(eq))
  }

  return (
    <div className="simulation-mode">
      <section className="simulation-header">
        <h2>시뮬레이션</h2>
        <p className="simulation-desc">
          배치된 레이아웃 기준으로 시간에 따라 출고·컨베이어·입고가 동작합니다. (기계 생산은 Phase B에서 연동)
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

      <section className="simulation-grid-wrap">
        <div
          className="simulation-grid"
          style={{
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
          }}
        >
          {Array.from({ length: rows * cols }, (_, i) => {
            const row = Math.floor(i / cols)
            const col = i % cols
            const key = cellKey(row, col)
            const eq = getEquipmentAt(layout, row, col)
            const itemId = simState.cellItems[key]
            const centerSet = eq ? centerCellsByEqId.get(eq.id) : undefined
            const isCenter = centerSet ? centerSet.has(key) : false
            const label =
              eq && isCenter
                ? eq.kind === 'conveyor'
                  ? '▸'
                  : eq.kind === 'inbound'
                    ? '입'
                    : eq.kind === 'outbound'
                      ? '출'
                      : String(eq.kind)
                : ''
            return (
              <div
                key={key}
                className={`simulation-cell ${eq ? `simulation-cell--${eq.kind}` : ''} ${eq && !isCenter ? 'simulation-cell--part' : ''} ${itemId ? 'simulation-cell--has-item' : ''}`}
                title={itemId ? `품목: ${itemId}` : undefined}
              >
                {itemId ? <span className="simulation-cell-item">{itemId}</span> : null}
                {label}
              </div>
            )
          })}
        </div>
      </section>

      <section className="simulation-warehouse-summary">
        <h3>창고 재고</h3>
        <ul className="simulation-warehouse-list">
          {Object.entries(simState.warehouse)
            .filter(([, qty]) => (qty ?? 0) > 0)
            .map(([itemId, qty]) => (
              <li key={itemId}>
                {itemId}: {qty ?? 0}
              </li>
            ))}
          {Object.keys(simState.warehouse).filter((id) => (simState.warehouse[id] ?? 0) > 0).length === 0 && (
            <li className="simulation-warehouse-empty">비어 있음</li>
          )}
        </ul>
      </section>
    </div>
  )
}

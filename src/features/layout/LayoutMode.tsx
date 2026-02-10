import { useState } from 'react'
import type { LayoutMap, PlacedEquipment, GridPosition } from '../../models/types'
import './LayoutMode.css'

type Props = {
  layout: LayoutMap
  onLayoutChange: (layout: LayoutMap) => void
}

export function LayoutMode({ layout: map, onLayoutChange }: Props) {
  const [selectedKind, setSelectedKind] = useState<PlacedEquipment['kind'] | null>(null)

  const handleCellClick = (pos: GridPosition) => {
    if (!selectedKind) return
    const id = `eq-${Date.now()}-${pos.row}-${pos.col}`
    onLayoutChange({
      ...map,
      equipment: [
        ...map.equipment,
        { id, kind: selectedKind, position: pos, rotation: 0 },
      ],
    })
  }

  const removeEquipment = (id: string) => {
    onLayoutChange({
      ...map,
      equipment: map.equipment.filter((e) => e.id !== id),
    })
  }

  const kinds: { value: PlacedEquipment['kind']; label: string }[] = [
    { value: 'inbound', label: '입고' },
    { value: 'conveyor', label: '컨베이어' },
    { value: 'storage', label: '보관' },
    { value: 'outbound', label: '출고' },
  ]

  return (
    <div className="layout-mode">
      <section className="layout-toolbar">
        <span className="layout-toolbar-label">장비 선택:</span>
        <div className="layout-toolbar-buttons">
          {kinds.map((k) => (
            <button
              key={k.value}
              className={selectedKind === k.value ? 'active' : ''}
              onClick={() => setSelectedKind(selectedKind === k.value ? null : k.value)}
            >
              {k.label}
            </button>
          ))}
        </div>
        {selectedKind && (
          <p className="layout-hint">그리드 칸을 클릭해 배치하세요. 배치된 장비를 클릭하면 제거됩니다.</p>
        )}
      </section>

      <section className="layout-grid-wrap">
        <div
          className="layout-grid"
          style={{
            gridTemplateRows: `repeat(${map.rows}, 1fr)`,
            gridTemplateColumns: `repeat(${map.cols}, 1fr)`,
          }}
        >
          {Array.from({ length: map.rows * map.cols }, (_, i) => {
            const row = Math.floor(i / map.cols)
            const col = i % map.cols
            const eq = map.equipment.find(
              (e) => e.position.row === row && e.position.col === col
            )
            return (
              <div
                key={i}
                className={`layout-cell ${eq ? 'has-equipment' : ''}`}
                onClick={() => (eq ? removeEquipment(eq.id) : handleCellClick({ row, col }))}
              >
                {eq && <span className="layout-cell-label">{eq.kind.slice(0, 2)}</span>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="layout-footer">
        <small>배치된 장비: {map.equipment.length}개</small>
      </section>
    </div>
  )
}

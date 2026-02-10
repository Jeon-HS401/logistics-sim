import { useState, useCallback } from 'react'
import type { WorkspaceState, Slot, LayoutMap, SlotVersion } from './models/types'
import {
  loadWorkspace,
  saveWorkspace,
  createSlot,
  updateSlot,
  addVersion,
  restoreSlotFromVersion,
} from './workspace'
import { WorkspaceBar } from './components/WorkspaceBar'
import { LayoutMode } from './features/layout/LayoutMode'
import { SimulationMode } from './features/simulation/SimulationMode'
import './App.css'

export type AppMode = 'layout' | 'simulation'

/**
 * 앱 전체 레이아웃 기반
 * - 헤더: 타이틀 + 모드 전환
 * - 작업영역 바: 슬롯 선택·새 슬롯·저장
 * - 본문: 모드별 콘텐츠 (배치 모드는 현재 슬롯의 layout 연동)
 */
function App() {
  const [mode, setMode] = useState<AppMode>('layout')
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => loadWorkspace())

  const currentSlot: Slot | null =
    workspace.currentSlotId != null
      ? workspace.slots.find((s) => s.id === workspace.currentSlotId) ?? null
      : null

  const persist = useCallback(() => saveWorkspace(workspace), [workspace])

  const handleSelectSlot = useCallback((slotId: string | null) => {
    setWorkspace((prev) => ({ ...prev, currentSlotId: slotId }))
  }, [])

  const handleNewSlot = useCallback(() => {
    const name = `슬롯 ${workspace.slots.length + 1}`
    const slot = createSlot(name)
    setWorkspace((prev) => ({
      ...prev,
      slots: [...prev.slots, slot],
      currentSlotId: slot.id,
    }))
  }, [workspace.slots.length])

  const handleSave = useCallback(() => {
    persist()
  }, [persist])

  const handleDeleteSlot = useCallback((slotId: string) => {
    setWorkspace((prev) => {
      const nextSlots = prev.slots.filter((s) => s.id !== slotId)
      const nextCurrent =
        prev.currentSlotId === slotId
          ? nextSlots[0]?.id ?? null
          : prev.currentSlotId
      return { ...prev, slots: nextSlots, currentSlotId: nextCurrent }
    })
  }, [])

  const handleLayoutChange = useCallback(
    (layout: LayoutMap) => {
      if (!currentSlot) return
      setWorkspace((prev) => ({
        ...prev,
        slots: prev.slots.map((s) =>
          s.id === currentSlot.id ? updateSlot(s, { layout }) : s
        ),
      }))
    },
    [currentSlot]
  )

  const handleRenameSlot = useCallback((slotId: string, newName: string) => {
    setWorkspace((prev) => ({
      ...prev,
      slots: prev.slots.map((s) =>
        s.id === slotId ? updateSlot(s, { name: newName }) : s
      ),
    }))
  }, [])

  const handleSaveVersion = useCallback((slotId: string, label?: string) => {
    setWorkspace((prev) => addVersion(prev, slotId, label))
  }, [])

  const handleRestoreVersion = useCallback((version: SlotVersion) => {
    setWorkspace((prev) => {
      const slot = prev.slots.find((s) => s.id === version.slotId)
      if (!slot) return prev
      const restored = restoreSlotFromVersion(slot, version)
      return {
        ...prev,
        slots: prev.slots.map((s) => (s.id === slot.id ? restored : s)),
      }
    })
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">물류 시뮬레이션</h1>
        <nav className="app-nav">
          <button
            className={mode === 'layout' ? 'active' : ''}
            onClick={() => setMode('layout')}
          >
            배치·테스트
          </button>
          <button
            className={mode === 'simulation' ? 'active' : ''}
            onClick={() => setMode('simulation')}
          >
            시뮬레이션
          </button>
        </nav>
      </header>

      <WorkspaceBar
        workspace={workspace}
        currentSlot={currentSlot}
        onSelectSlot={handleSelectSlot}
        onNewSlot={handleNewSlot}
        onSave={handleSave}
        onDeleteSlot={handleDeleteSlot}
        onRenameSlot={handleRenameSlot}
        onSaveVersion={handleSaveVersion}
        onRestoreVersion={handleRestoreVersion}
      />

      <main className="app-main">
        {mode === 'layout' && (
          <LayoutMode
            layout={currentSlot?.layout ?? { rows: 8, cols: 12, equipment: [] }}
            onLayoutChange={handleLayoutChange}
          />
        )}
        {mode === 'simulation' && <SimulationMode />}
      </main>
    </div>
  )
}

export default App

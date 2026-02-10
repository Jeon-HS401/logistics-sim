import { useState, useRef, useEffect } from 'react'
import type { WorkspaceState, Slot, SlotVersion } from '../models/types'
import './WorkspaceBar.css'

type Props = {
  workspace: WorkspaceState
  currentSlot: Slot | null
  onSelectSlot: (slotId: string | null) => void
  onNewSlot: () => void
  onSave: () => void
  onDeleteSlot?: (slotId: string) => void
  onRenameSlot?: (slotId: string, name: string) => void
  onSaveVersion?: (slotId: string, label?: string) => void
  onRestoreVersion?: (version: SlotVersion) => void
}

function formatVersionDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

export function WorkspaceBar({
  workspace,
  currentSlot,
  onSelectSlot,
  onNewSlot,
  onSave,
  onDeleteSlot,
  onRenameSlot,
  onSaveVersion,
  onRestoreVersion,
}: Props) {
  const hasSlots = workspace.slots.length > 0
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [versionOpen, setVersionOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const versions: SlotVersion[] = currentSlot
    ? (workspace.versionsBySlotId?.[currentSlot.id] ?? [])
    : []

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingName])

  const startEditName = () => {
    if (!currentSlot || !onRenameSlot) return
    setEditNameValue(currentSlot.name)
    setEditingName(true)
  }

  const submitEditName = () => {
    if (!currentSlot || !onRenameSlot) return
    const trimmed = editNameValue.trim()
    if (trimmed) onRenameSlot(currentSlot.id, trimmed)
    setEditingName(false)
  }

  return (
    <aside className="workspace-bar" aria-label="작업 환경">
      <div className="workspace-bar__slots">
        {!hasSlots ? (
          <span className="workspace-bar__empty">슬롯 없음</span>
        ) : (
          <>
            <select
              className="workspace-bar__select"
              value={workspace.currentSlotId ?? ''}
              onChange={(e) => {
                setEditingName(false)
                setVersionOpen(false)
                onSelectSlot(e.target.value || null)
              }}
              aria-label="작업 슬롯 선택"
            >
              <option value="">선택</option>
              {workspace.slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {currentSlot && onRenameSlot && (
              <>
                {editingName ? (
                  <input
                    ref={inputRef}
                    type="text"
                    className="workspace-bar__name-input"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onBlur={submitEditName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitEditName()
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                    aria-label="슬롯 이름"
                  />
                ) : (
                  <button
                    type="button"
                    className="workspace-bar__name-edit"
                    onClick={startEditName}
                    title="이름 편집"
                  >
                    ✎
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="workspace-bar__actions">
        <button
          type="button"
          className="workspace-bar__btn workspace-bar__btn--primary"
          onClick={onNewSlot}
        >
          새 슬롯
        </button>
        <button
          type="button"
          className="workspace-bar__btn"
          onClick={onSave}
          disabled={!currentSlot}
          title={currentSlot ? '현재 슬롯 저장' : '슬롯을 선택하세요'}
        >
          저장
        </button>
        {currentSlot && onSaveVersion && (
          <div className="workspace-bar__version-wrap">
            <button
              type="button"
              className="workspace-bar__btn"
              onClick={() => onSaveVersion(currentSlot.id)}
              title="현재 상태를 버전으로 저장"
            >
              버전 저장
            </button>
            <div className="workspace-bar__version-drop">
              <button
                type="button"
                className="workspace-bar__btn"
                onClick={() => setVersionOpen((v) => !v)}
                title="버전 목록"
              >
                버전 ({versions.length})
              </button>
              {versionOpen && (
                <>
                  <div
                    className="workspace-bar__version-backdrop"
                    onClick={() => setVersionOpen(false)}
                  />
                  <div className="workspace-bar__version-list">
                    {versions.length === 0 ? (
                      <p className="workspace-bar__version-empty">저장된 버전 없음</p>
                    ) : (
                      versions.map((v) => (
                        <div key={v.id} className="workspace-bar__version-item">
                          <span className="workspace-bar__version-meta">
                            {v.label || '(이름 없음)'} · {formatVersionDate(v.savedAt)}
                          </span>
                          {onRestoreVersion && (
                            <button
                              type="button"
                              className="workspace-bar__btn workspace-bar__btn--small"
                              onClick={() => {
                                onRestoreVersion(v)
                                setVersionOpen(false)
                              }}
                            >
                              복원
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {currentSlot && onDeleteSlot && (
          <button
            type="button"
            className="workspace-bar__btn workspace-bar__btn--danger"
            onClick={() => onDeleteSlot(currentSlot.id)}
            title="이 슬롯 삭제"
          >
            삭제
          </button>
        )}
      </div>
      {currentSlot && (
        <span className="workspace-bar__info">
          장비 {currentSlot.layout.equipment.length}개
        </span>
      )}
    </aside>
  )
}

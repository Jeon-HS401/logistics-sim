/**
 * 창고·관리 패널 등 오버레이용 모달.
 * 별도 페이지 없이 가시성 확보 및 다른 기능과 분리.
 */

import { useEffect } from 'react'
import './Modal.css'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** 접근성: 모달 설명 (스크린리더) */
  ariaDescribedby?: string
}

export function Modal({ open, onClose, title, children, ariaDescribedby }: Props) {
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={ariaDescribedby}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel">
        <header className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}

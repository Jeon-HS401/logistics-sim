import { useState } from 'react'
import { LayoutMode } from './features/layout/LayoutMode'
import { SimulationMode } from './features/simulation/SimulationMode'
import './App.css'

export type AppMode = 'layout' | 'simulation'

function App() {
  const [mode, setMode] = useState<AppMode>('layout')

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
      <main className="app-main">
        {mode === 'layout' && <LayoutMode />}
        {mode === 'simulation' && <SimulationMode />}
      </main>
    </div>
  )
}

export default App

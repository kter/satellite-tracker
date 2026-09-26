import { SceneRoot } from './scene/SceneRoot'
import { Hud } from './components/Hud'
import { usePropagator } from './hooks/usePropagator'
import { useFrameStatsSync } from './hooks/useFrameStatsSync'

export default function App() {
  usePropagator()
  useFrameStatsSync()
  return (
    <div className="app">
      <SceneRoot />
      <Hud />
    </div>
  )
}

import { SceneRoot } from './scene/SceneRoot'
import { Hud } from './components/Hud'
import { usePropagator } from './hooks/usePropagator'

export default function App() {
  usePropagator()
  return (
    <div className="app">
      <SceneRoot />
      <Hud />
    </div>
  )
}

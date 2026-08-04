export function ContextPanel({ children }) {
  return (
    <aside className="panel studio-panel--left context-panel campaign-context-panel">
      {children}
    </aside>
  );
}

export function CanvasPanel({ canvasRef, children }) {
  return (
    <section
      className="stage canvas-panel campaign-canvas-panel"
      ref={canvasRef}
    >
      {children}
    </section>
  );
}

export function DirectionPanel({ children }) {
  return (
    <aside className="panel studio-panel--right direction-panel campaign-direction-panel">
      {children}
    </aside>
  );
}

export function BottomWorkspace({ children }) {
  return (
    <section className="asset-list bottom-workspace campaign-bottom-workspace">
      {children}
    </section>
  );
}

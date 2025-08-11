const { useState, useEffect } = React;

function EffectsPanel() {
  const [effects, setEffects] = useState([]);
  const [paintingId, setPaintingId] = useState(null);

  useEffect(() => {
    const update = () => {
      setEffects([...effectsManager.activeEffects]);
      setPaintingId(effectsManager.paintingEffectId);
      setTimeout(() => effectsManager.setupCollapseListeners(), 0);
    };
    document.addEventListener('effectsUpdated', update);
    update();
    return () => document.removeEventListener('effectsUpdated', update);
  }, []);

  const renderTitle = (effect, idx) => {
    const hasMask = effect.maskCanvas ? ' 🎨' : '';
    const isActive = paintingId === effect.id ? ' ✏️' : '';
    if (effect.type === 'maskSway') return `Máscara (Cabelo) #${idx + 1}${hasMask}${isActive}`;
    if (effect.type === 'wave') return `Ondulação #${idx + 1}${hasMask}${isActive}`;
    if (effect.type === 'saber') return `Saber #${idx + 1}${hasMask}${isActive}`;
    return `Respiração #${idx + 1}`;
  };

  const isExpanded = (effect, idx) =>
    paintingId === effect.id ||
    paintingId === `exclusion_${effect.id}` ||
    (paintingId === null && idx === effects.length - 1);

  return (
    <div className="d-flex flex-column h-100 gap-3">
      <div className="card bg-body-tertiary flex-grow-1">
        <div className="card-body d-flex flex-column">
          <h6 className="card-title mb-3 text-center">Efeitos Ativos</h6>
          <div className="flex-grow-1">
            {effects.length === 0 ? (
              <p className="text-center text-body-secondary mt-4">Nenhum efeito adicionado.</p>
            ) : (
              <div className="accordion" id="effectsAccordion">
                {effects.map((effect, idx) => {
                  const collapseId = `collapse-${effect.id}`;
                  const headingId = `heading-${effect.id}`;
                  return (
                    <div className="accordion-item border-secondary mb-2" key={effect.id}>
                      <h2 className="accordion-header" id={headingId}>
                        <button
                          className={`accordion-button ${isExpanded(effect, idx) ? '' : 'collapsed'}`}
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#${collapseId}`}
                          aria-expanded={isExpanded(effect, idx)}
                          aria-controls={collapseId}
                        >
                          {renderTitle(effect, idx)}
                        </button>
                      </h2>
                      <div
                        id={collapseId}
                        className={`accordion-collapse collapse ${isExpanded(effect, idx) ? 'show' : ''}`}
                        aria-labelledby={headingId}
                        data-bs-parent="#effectsAccordion"
                      >
                        <div
                          className="accordion-body p-2"
                          dangerouslySetInnerHTML={{ __html: effectsManager.renderEffectControls(effect) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="btn-group d-block mb-2">
          <button type="button" className="btn btn-primary dropdown-toggle w-100" data-bs-toggle="dropdown" aria-expanded="false">
            Adicionar Efeito
          </button>
          <ul className="dropdown-menu w-100">
            <li><a className="dropdown-item" href="#" onClick={() => effectsManager.addEffect('breathing')}><span className="me-2">💨</span>Respiração</a></li>
            <li><a className="dropdown-item" href="#" onClick={() => effectsManager.addEffect('maskSway')}><span className="me-2">💇</span>Cabelo (Máscara)</a></li>
            <li><a className="dropdown-item" href="#" onClick={() => effectsManager.addEffect('wave')}><span className="me-2">🌊</span>Ondulação</a></li>
            <li><a className="dropdown-item" href="#" onClick={() => effectsManager.addEffect('saber')}><span className="me-2">⚔️</span>Saber</a></li>
          </ul>
        </div>
        <div className="btn-group d-block">
          <button type="button" className="btn btn-success btn-lg dropdown-toggle w-100" data-bs-toggle="dropdown" aria-expanded="false" id="exportBtn" disabled>Exportar Animação</button>
          <ul className="dropdown-menu w-100">
            <li><a className="dropdown-item" href="#" id="downloadGif">Exportar como GIF</a></li>
            <li><a className="dropdown-item" href="#" id="downloadWebM">Exportar como WebM (Vídeo)</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('effectsRoot')).render(<EffectsPanel />);

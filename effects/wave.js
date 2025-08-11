// Wave effect definition
window.effectsRegistry.register('wave', () => ({
  id: Date.now() + Math.random(),
  type: 'wave',
  strength: 0.015,
  radius: 0.3,
  softness: 0.3,
  speed: 2.0,
  phase: 0.0,
  marker: { x: 0.5, y: 0.5 },
  showPreview: true,
  expanded: true,
  waveSize: 15.0,
  waveDirection: { x: 1.0, y: 0.0 },
  maskCanvas: null,
  maskCtx: null,
  maskTexture: null,
  brush: {
    size: 20,
    hardness: 1.0,
    erase: false
  },
  exclusionMask: {
    enabled: false,
    brush: {
      size: 30,
      hardness: 0.8,
      erase: false
    }
  }
}));

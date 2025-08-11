// Mask sway (hair) effect definition
window.effectsRegistry.register('maskSway', () => ({
  id: Date.now() + Math.random(),
  type: 'maskSway',
  strength: 0.005,
  speed: 1.0,
  noiseScale: 0.8,
  align: 0.5,
  wind: { x: 0.005, y: 0.002 },
  phase: 0.0,
  showPreview: true,
  expanded: true,
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

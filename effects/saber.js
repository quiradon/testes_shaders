// Saber effect definition
window.effectsRegistry.register('saber', () => ({
  id: Date.now() + Math.random(),
  type: 'saber',
  strength: 0.025,
  speed: 1.2,
  phase: 0.0,
  turbulence: 0.8,
  color: '#ff6b35',
  fuzziness: 0.4,
  baseSize: 1.2,
  verticalFalloff: 2.0,
  pulseIntensity: 1.0,
  showPreview: true,
  expanded: true,
  maskCanvas: null,
  maskCtx: null,
  maskTexture: null,
  brush: {
    size: 30,
    hardness: 0.8,
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

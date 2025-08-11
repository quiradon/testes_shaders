// Breathing effect definition
window.effectsRegistry.register('breathing', () => ({
  id: Date.now() + Math.random(),
  type: 'breathing',
  strength: 0.03,
  radius: 0.4,
  softness: 0.4,
  speed: 1.5,
  phase: 0.0,
  marker: { x: 0.5, y: 0.5 },
  showPreview: true,
  expanded: true,
  exclusionMask: {
    enabled: false,
    brush: {
      size: 30,
      hardness: 0.8,
      erase: false
    }
  }
}));

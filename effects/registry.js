// Global registry for effect factory functions
window.effectsRegistry = {
  _factories: {},

  /**
   * Register a new effect factory under the given type.
   * @param {string} type
   * @param {Function} factory
   */
  register(type, factory) {
    this._factories[type] = factory;
  },

  /**
   * Create an effect instance by type.
   * @param {string} type
   * @returns {Object|null}
   */
  create(type) {
    const factory = this._factories[type];
    return factory ? factory() : null;
  }
};

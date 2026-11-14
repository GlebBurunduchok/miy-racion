/* Browser storage is optional: a denied/quota-limited store must not crash the UI. */
(function (root) {
  'use strict';
  const KEY = 'mii-ratsion.v1';
  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      return {
        state: raw ? root.RationCore.migrate(JSON.parse(raw)) : root.RationCore.defaults(),
        recovery: null,
        error: false
      };
    } catch {
      return { state: root.RationCore.defaults(), recovery: raw, error: true };
    }
  }
  function save(state, recovery = null) {
    try {
      if (!root.RationCore.validState(state)) return false;
      const serialized = JSON.stringify(state);
      if (recovery) localStorage.setItem(KEY + '.recovery', recovery);
      localStorage.setItem(KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }
  root.RationStorage = { key: KEY, load, save };
  if (typeof module !== 'undefined') module.exports = root.RationStorage;
})(typeof window === 'undefined' ? globalThis : window);

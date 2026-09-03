// Wraps localStorage so pages where it's disabled or inaccessible (Safari's
// "block all cookies" setting, some in-app browser webviews, third-party
// storage restrictions) degrade to an in-memory fallback instead of
// crashing the whole app on boot. Seen in Sentry: window.localStorage can
// be null rather than throwing in these contexts, and it was read
// unguarded in the router's very first navigation guard.
function createFallbackStorage() {
  const store = {};
  return {
    getItem: key => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
  };
}

function detectStorage() {
  try {
    const testKey = '__chalan_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    return createFallbackStorage();
  }
}

export default detectStorage();

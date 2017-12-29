const FSA_ALLOWED_KEYS = ['error', 'payload', 'send', 'type'];

module.exports = function isFSA(action) {
  return (
    action
    && typeof action.type === 'string'
    && (typeof action.error === 'boolean' || typeof action.error === 'undefined' || action.error === null)
    && (typeof action.send === 'boolean' || typeof action.send === 'string' || typeof action.error === 'undefined' || action.error === null)
    && Object.keys(action).every(key => FSA_ALLOWED_KEYS.includes(key))
  );
}

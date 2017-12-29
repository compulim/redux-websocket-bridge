import isFSA from './isFSA';

test('return true on FSA-compliant action without payload', () => {
  expect(isFSA({ type: 'ACTION_NAME' })).toBe(true);
});

test('return true on FSA-compliant action with payload', () => {
  expect(isFSA({ type: 'ACTION_NAME', payload: {} })).toBe(true);
});

test('return true on FSA-compliant action with meta', () => {
  expect(isFSA({ type: 'ACTION_NAME', meta: {} })).toBe(true);
});

test('return true on FSA-compliant error action', () => {
  expect(isFSA({ type: 'ACTION_NAME', error: true })).toBe(true);
});

test('return true on FSA-compliant error action with payload', () => {
  expect(isFSA({ type: 'ACTION_NAME', error: true, payload: new Error() })).toBe(true);
});

test('return true on FSA-compliant error action with "error" set to null', () => {
  expect(isFSA({ type: 'ACTION_NAME', error: null })).toBe(true);
});

test('return true on FSA-compliant error action with "error" set to undefined', () => {
  expect(isFSA({ type: 'ACTION_NAME', error: undefined })).toBe(true);
});

test('return false on action without "type"', () => {
  expect(isFSA({ payload: 123 })).toBe(false);
});

test('return false on action with non-string "type"', () => {
  expect(isFSA({ type: 123 })).toBe(false);
});

test('return false on action with non-boolean "error"', () => {
  expect(isFSA({ type: 'ERROR', error: 123 })).toBe(false);
});

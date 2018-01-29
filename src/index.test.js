import { applyMiddleware, createStore } from 'redux';
import ReduxWebSocketBridge, { CLOSE, MESSAGE, OPEN } from '.';

function createStoreWithBridge(ws, reducer, options) {
  return applyMiddleware(ReduxWebSocketBridge(() => ws, options))(createStore)(reducer || ((state = {}) => state));
}

test('should handle onopen', () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => {
    if (action.type === `@@websocket/${ OPEN }`) {
      state = { ...state, connected: true, from: action.meta.webSocket };
    }

    return state;
  });

  ws.onopen();

  expect(store.getState()).toHaveProperty('connected', true);
  expect(store.getState()).toHaveProperty('from', ws);
});

test('should handle onclose', () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => {
    if (action.type === `@@websocket/${ CLOSE }`) {
      state = { ...state, connected: false, from: action.meta.webSocket };
    }

    return state;
  });

  ws.onopen();
  ws.onclose();

  expect(store.getState()).toHaveProperty('connected', false);
  expect(store.getState()).toHaveProperty('from', ws);
});

test('should emit message', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => {
    if (action.type === `@@websocket/${ MESSAGE }`) {
      state = { ...state, message: action.payload, from: action.meta.webSocket };
    }

    return state;
  });

  ws.onopen();
  ws.onmessage({ data: 'Hello, World!' });

  // TODO: onmessage is asynchronous, figure out a better way like expect.eventually.toBe();
  await Promise.resolve();

  expect(store.getState()).toHaveProperty('message', 'Hello, World!');
  expect(store.getState()).toHaveProperty('from', ws);
});

test('should unfold message', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => {
    if (action.type === 'SERVER/SIGN_IN_FULFILLED') {
      state = { ...state, ...action.meta, ...action.payload };
    }

    return state;
  });

  ws.onopen();
  ws.onmessage({
    data: JSON.stringify({
      type: 'SERVER/SIGN_IN_FULFILLED',
      meta: {
        protocol: 1
      },
      payload: {
        userID: 'u-12345',
        token: 't-abcde'
      }
    })
  });

  // TODO: Find better way to sleep
  await Promise.resolve();

  expect(store.getState()).toHaveProperty('protocol', 1);
  expect(store.getState()).toHaveProperty('userID', 'u-12345');
  expect(store.getState()).toHaveProperty('token', 't-abcde');
  expect(store.getState()).toHaveProperty('from', ws);
});

test('should unfold with a custom "from" meta', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => {
    if (action.type === 'HELLO') {
      state = { ...state, ...action.meta };
    }

    return state;
  }, {
    meta: { from: 'HAWAII' }
  });

  ws.onopen();
  ws.onmessage({ data: JSON.stringify({ type: 'HELLO' }) });

  // TODO: Find better way to sleep
  await Promise.resolve();

  expect(store.getState()).toHaveProperty('from', 'HAWAII');
});

test('should unfold with "from" meta set to false', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => {
    if (action.type === 'HELLO') {
      state = { ...state, ...action.meta };
    }

    return state;
  }, {
    meta: { from: false }
  });

  ws.onopen();
  ws.onmessage({ data: JSON.stringify({ type: 'HELLO' }) });

  // TODO: Find better way to sleep
  await Promise.resolve();

  expect(store.getState()).not.toHaveProperty('from');
});

test('should send raw text', () => {
  const send = jest.fn();
  const ws = { send };
  const store = createStoreWithBridge(ws);

  ws.onopen();

  store.dispatch({
    type: '@@websocket/SEND',
    payload: 'Hello, World!'
  });

  expect(send).toHaveBeenCalledWith('Hello, World!');
});

test('should send raw binary', () => {
  const send = jest.fn(data => {
    expect(data).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(data)[0]).toBe(12);
  });
  const ws = { send };
  const store = createStoreWithBridge(ws);
  const payload = new ArrayBuffer(1);

  new Uint8Array(payload).set([12], 0);

  ws.onopen();

  store.dispatch({
    type: '@@websocket/SEND',
    payload
  });

  expect(send).toHaveBeenCalledWith(payload);
});

test('should send action', () => {
  const send = jest.fn();
  const ws = { send };
  const store = createStoreWithBridge(ws);

  ws.onopen();

  store.dispatch({
    type: 'SERVER/SIGN_IN',
    meta: { send: true },
    payload: {
      userID: 'u-12345',
      token: 't-abcde'
    }
  });

  expect(send).toHaveBeenCalledWith(JSON.stringify({
    type: 'SERVER/SIGN_IN',
    payload: {
      userID: 'u-12345',
      token: 't-abcde'
    }
  }));
});

test('should namespace WebSocket events', async () => {
  const ws1 = {};
  const ws2 = {};
  const store = applyMiddleware(
    ReduxWebSocketBridge(() => ws1, { namespace: 'SERVER1/' }),
    ReduxWebSocketBridge(() => ws2, { namespace: 'SERVER2/' })
  )(createStore)((state = {}, action) => {
    switch (action.type) {
    case `SERVER1/${ OPEN }`: state = { ...state, server1: true }; break;
    case `SERVER2/${ OPEN }`: state = { ...state, server2: true }; break;

    case `SERVER1/${ MESSAGE }`: state = { ...state, server1: action.payload }; break;
    case `SERVER2/${ MESSAGE }`: state = { ...state, server2: action.payload }; break;

    case `SERVER1/${ CLOSE }`: state = { ...state, server1: false }; break;
    case `SERVER2/${ CLOSE }`: state = { ...state, server2: false }; break;
    }

    return state;
  });

  ws1.onopen();
  expect(store.getState()).toEqual({ server1: true });

  ws2.onopen()
  expect(store.getState()).toEqual({ server1: true, server2: true });

  ws1.onmessage({ data: 'Hello' });
  await Promise.resolve();
  expect(store.getState()).toEqual({ server1: 'Hello', server2: true });

  ws2.onmessage({ data: 'Aloha' });
  await Promise.resolve();
  expect(store.getState()).toEqual({ server1: 'Hello', server2: 'Aloha' });

  ws1.onclose();
  expect(store.getState()).toEqual({ server1: false, server2: 'Aloha' });

  ws2.onclose()
  expect(store.getState()).toEqual({ server1: false, server2: false });
});

test('should send targeted action', () => {
  const send1 = jest.fn();
  const send2 = jest.fn();
  const ws1 = { send: send1 };
  const ws2 = { send: send2 };
  const store = applyMiddleware(
    ReduxWebSocketBridge(() => ws1, { tags: ['SERVER/1/NODE'] }),
    ReduxWebSocketBridge(() => ws2, { tags: ['SERVER/2/BROWSER'] })
  )(createStore)((state = {}) => state);

  ws1.onopen();
  ws2.onopen();

  store.dispatch({
    type: 'SERVER/SIGN_IN',
    meta: { send: 'SERVER/1/NODE' },
    payload: {
      userID: 'u-12345',
      token: 't-abcde'
    }
  });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({
    type: 'SERVER/SIGN_IN',
    payload: {
      userID: 'u-12345',
      token: 't-abcde'
    }
  }));

  expect(send2).toHaveBeenCalledTimes(0);

  store.dispatch({
    type: 'SERVER/SIGN_IN',
    meta: { send: ws2 },
    payload: {
      userID: 'u-98765',
      token: 't-zyxwv'
    }
  });

  expect(send2).toHaveBeenCalledWith(JSON.stringify({
    type: 'SERVER/SIGN_IN',
    payload: {
      userID: 'u-98765',
      token: 't-zyxwv'
    }
  }));

  store.dispatch({
    type: 'SERVER/PING',
    meta: { send: true }
  });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: 'SERVER/PING' }));
  expect(send2).toHaveBeenCalledWith(JSON.stringify({ type: 'SERVER/PING' }));
});

test('should send to string "tags"', () => {
  const send1 = jest.fn();
  const send2 = jest.fn();
  const ws1 = { send: send1 };
  const ws2 = { send: send2 };
  const store = applyMiddleware(
    ReduxWebSocketBridge(() => ws1, { tags: 'SERVER/1/NODE' }),
    ReduxWebSocketBridge(() => ws2, {})
  )(createStore)((state = {}) => state);

  ws1.onopen();
  ws2.onopen();

  store.dispatch({ type: 'HELLO', meta: { send: 'SERVER/1/NODE' } });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: 'HELLO' }));
  expect(send2).toHaveBeenCalledTimes(0);
});

test('should send to minimatch "tags"', () => {
  const send1 = jest.fn();
  const send2 = jest.fn();
  const ws1 = { send: send1 };
  const ws2 = { send: send2 };
  const store = applyMiddleware(
    ReduxWebSocketBridge(() => ws1, { tags: 'SERVER/1/NODE' }),
    ReduxWebSocketBridge(() => ws2, {})
  )(createStore)((state = {}) => state);

  ws1.onopen();
  ws2.onopen();

  // matching segment segment
  store.dispatch({ type: 'SERVER/*/NODE', meta: { send: 'SERVER/*/NODE' } });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: 'SERVER/*/NODE' }));
  expect(send2).toHaveBeenCalledTimes(0);

  // matching third segment
  store.dispatch({ type: 'SERVER/1/*', meta: { send: 'SERVER/1/*' } });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: 'SERVER/1/*' }));
  expect(send2).toHaveBeenCalledTimes(0);

  // not matching third segment
  store.dispatch({ type: 'SERVER/*/BROWSER', meta: { send: 'SERVER/*/BROWSER' } });

  expect(send1).not.toHaveBeenCalledWith(JSON.stringify({ type: 'SERVER/*/BROWSER' }));
  expect(send2).toHaveBeenCalledTimes(0);

  // not matching first segment only
  store.dispatch({ type: 'SERVER', meta: { send: 'SERVER' } });

  expect(send1).not.toHaveBeenCalledWith(JSON.stringify({ type: 'SERVER' }));
  expect(send2).toHaveBeenCalledTimes(0);

  // no matching without third segment
  store.dispatch({ type: 'SERVER/*', meta: { send: 'SERVER/*' } });

  expect(send1).not.toHaveBeenCalledWith(JSON.stringify({ type: 'SERVER/*' }));
  expect(send2).toHaveBeenCalledTimes(0);

  // matching any second and beyond segments
  store.dispatch({ type: 'SERVER/**/*', meta: { send: 'SERVER/**/*' } });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: 'SERVER/**/*' }));
  expect(send2).toHaveBeenCalledTimes(0);

  // matching bracelets expansion
  store.dispatch({ type: '{CLIENT,SERVER}/**/*', meta: { send: '{CLIENT,SERVER}/**/*' } });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: '{CLIENT,SERVER}/**/*' }));
  expect(send2).toHaveBeenCalledTimes(0);

  // matching multiple segments thru Array
  store.dispatch({ type: 'CLIENT/**/*,SERVER/**/*', meta: { send: ['CLIENT/**/*', 'SERVER/**/*'] } });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: 'CLIENT/**/*,SERVER/**/*' }));
  expect(send2).toHaveBeenCalledTimes(0);
});

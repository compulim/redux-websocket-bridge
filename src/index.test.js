import { applyMiddleware, createStore } from 'redux';
import ReduxWebSocketBridge, { CLOSE, MESSAGE, OPEN, SEND } from '.';

const REDUX_INIT = '@@redux/INIT';

function createStoreWithBridge(ws, reducer, options) {
  return applyMiddleware(ReduxWebSocketBridge(() => ws, options))(createStore)(reducer || ((state = {}) => state));
}

function deleteKey(map, key) {
  const { [key]: deleted, ...nextMap } = map;

  return nextMap;
}

test('should handle onopen', () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => ({ ...state, action }));

  ws.onopen();

  expect(store.getState()).toHaveProperty('action.meta.webSocket', ws);
  expect(store.getState()).toHaveProperty('action.type', `@@websocket/${ OPEN }`);
});

test('should handle onclose', () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => ({ ...state, action }));

  ws.onopen();
  ws.onclose();

  expect(store.getState()).toHaveProperty('action.meta.webSocket', ws);
  expect(store.getState()).toHaveProperty('action.type', `@@websocket/${ CLOSE }`);
});

test('should emit message', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => ({ ...state, action }));

  ws.onopen();
  ws.onmessage({ data: 'Hello, World!' });

  // TODO: onmessage is asynchronous, figure out a better way like expect.eventually.toBe();
  await Promise.resolve();

  expect(store.getState()).toHaveProperty('action.meta.webSocket', ws);
  expect(store.getState()).toHaveProperty('action.type', `@@websocket/${ MESSAGE }`);
  expect(store.getState()).toHaveProperty('action.payload', 'Hello, World!');
});

test('should unfold message with custom "unfold"', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => ({ ...state, action }), {
    unfold: (action, webSocket) => ({
      ...action,
      meta: {
        add      : 'meta added',
        change   : 'meta changed',
        copy     : action.meta.copy,
        undefined: undefined,
        webSocket
      }
    })
  });

  ws.onopen();
  ws.onmessage({
    data: JSON.stringify({
      type: 'ACTION_TYPE',
      meta: {
        change: 'meta unchanged',
        copy  : 'meta copied',
        remove: 'meta removed'
      },
      payload: {
        token : 't-abcde',
        userID: 'u-12345'
      }
    })
  });

  // TODO: Find better way to sleep
  await Promise.resolve();

  expect(store.getState()).toHaveProperty('action.meta.add', 'meta added');
  expect(store.getState()).toHaveProperty('action.meta.change', 'meta changed');
  expect(store.getState()).toHaveProperty('action.meta.copy', 'meta copied');
  expect(store.getState().action.meta.undefined).toBeUndefined();
  expect(store.getState()).not.toHaveProperty('action.meta.remove');
  expect(store.getState()).toHaveProperty('action.meta.webSocket', ws);

  expect(store.getState()).toHaveProperty('action.payload.userID', 'u-12345');
  expect(store.getState()).toHaveProperty('action.payload.token', 't-abcde');

  expect(store.getState()).toHaveProperty('action.type', 'ACTION_TYPE');
});

test('should unfold message with custom "unfold" stripping out "meta"', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => ({ ...state, action }), {
    unfold: action => {
      const { meta, ...actionWithoutMeta } = action;

      return actionWithoutMeta;
    }
  });

  ws.onopen();
  ws.onmessage({
    data: JSON.stringify({
      type: 'ACTION_TYPE',
      payload: {
        token : 't-abcde',
        userID: 'u-12345'
      }
    })
  });

  // TODO: Find better way to sleep
  await Promise.resolve();

  expect(store.getState()).not.toHaveProperty('action.meta');

  expect(store.getState()).toHaveProperty('action.payload.userID', 'u-12345');
  expect(store.getState()).toHaveProperty('action.payload.token', 't-abcde');

  expect(store.getState()).toHaveProperty('action.type', 'ACTION_TYPE');
});

test('should unfold message with custom unfold to copy whole "meta"', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => ({ ...state, action }), {
    unfold: (action, webSocket) => ({
      ...action,
      meta: {
        ...action.meta,
        webSocket
      }
    })
  });

  ws.onopen();
  ws.onmessage({
    data: JSON.stringify({
      type: 'ACTION_TYPE',
      meta: {
        copy: 'meta copied'
      }
    })
  });

  // TODO: Find better way to sleep
  await Promise.resolve();

  expect(store.getState()).toHaveProperty('action.meta.copy', 'meta copied');
  expect(store.getState()).toHaveProperty('action.meta.webSocket', ws);

  expect(store.getState()).toHaveProperty('action.type', 'ACTION_TYPE');
});

test('should send raw text', () => {
  const send = jest.fn();
  const ws = { send };
  const store = createStoreWithBridge(ws);

  ws.onopen();

  store.dispatch({
    type: `@@websocket/${ SEND }`,
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
    type: `@@websocket/${ SEND }`,
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
    type: 'ACTION_TYPE',
    meta: {
      send: true,
      shouldStrip: 'should strip out all meta'
    },
    payload: {
      userID: 'u-12345',
      token: 't-abcde'
    }
  });

  expect(send).toHaveBeenCalledWith(JSON.stringify({
    type: 'ACTION_TYPE',
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
    ReduxWebSocketBridge(() => ws1, { fold: action => (action.type === 'ACTION_FOR_WS1' || action.type === 'ACTION_FOR_ALL') && action }),
    ReduxWebSocketBridge(() => ws2, { fold: action => (action.type === 'ACTION_FOR_WS2' || action.type === 'ACTION_FOR_ALL') && action })
  )(createStore)((state = {}) => state);

  ws1.onopen();
  ws2.onopen();

  store.dispatch({ type: 'ACTION_FOR_WS1' });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: 'ACTION_FOR_WS1' }));
  expect(send2).toHaveBeenCalledTimes(0);

  store.dispatch({ type: 'ACTION_FOR_WS2' });

  expect(send1).toHaveBeenCalledTimes(1);
  expect(send2).toHaveBeenCalledWith(JSON.stringify({ type: 'ACTION_FOR_WS2' }));

  store.dispatch({ type: 'ACTION_FOR_ALL' });

  expect(send1).toHaveBeenCalledWith(JSON.stringify({ type: 'ACTION_FOR_ALL' }));
  expect(send2).toHaveBeenCalledWith(JSON.stringify({ type: 'ACTION_FOR_ALL' }));
});

test('should unfold with custom "receive" function', async () => {
  const ws = {};
  const store = createStoreWithBridge(ws, (state = {}, action) => ({ ...state, action }), {
    receive: payload => JSON.parse(new Buffer(payload, 'base64').toString())
  });

  ws.onopen();
  ws.onmessage({
    data: new Buffer(JSON.stringify({
      type: 'ACTION_TYPE',
      payload: {
        token : 't-abcde',
        userID: 'u-12345'
      }
    })).toString('base64')
  });

  // TODO: Find better way to sleep
  await Promise.resolve();

  expect(store.getState()).toHaveProperty('action.payload.userID', 'u-12345');
  expect(store.getState()).toHaveProperty('action.payload.token', 't-abcde');

  expect(store.getState()).toHaveProperty('action.type', 'ACTION_TYPE');
});

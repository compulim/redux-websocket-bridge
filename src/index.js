import blobToArrayBuffer from './blobToArrayBuffer';
import isFSA             from './isFSA';

export const CLOSE = `CLOSE`;
export const MESSAGE = `MESSAGE`;
export const OPEN = `OPEN`;
export const SEND = `SEND`;

export function close() {
  return { type: CLOSE };
}

export function message(payload) {
  return { type: MESSAGE, payload }
}

export function open() {
  return { type: OPEN };
}

const DEFAULT_OPTIONS = {
  actionPrefix: '@@websocket/',
  binaryType: 'arrayBuffer',
  unfold: false
};

export default function createWebSocketMiddleware(urlOrFactory, options = DEFAULT_OPTIONS) {
  options = { ...DEFAULT_OPTIONS, ...options };

  const { actionPrefix } = options;

  return store => {
    let ws;

    if (typeof urlOrFactory === 'function') {
      ws = urlOrFactory();
    } else {
      ws = new WebSocket(urlOrFactory);
    }

    ws.onopen = () => store.dispatch({ type: `${ actionPrefix }${ OPEN }` });
    ws.onclose = () => store.dispatch({ type: `${ actionPrefix }${ CLOSE }` });
    ws.onmessage = event => {
      if (event.data instanceof Blob) {
        blobToArrayBuffer(event.data).then(payload => {
          store.dispatch({
            type: `${ actionPrefix }${ MESSAGE }`,
            payload
          });
        });
      } else {
        store.dispatch({
          type: `${ actionPrefix }${ MESSAGE }`,
          payload: event.data
        });
      }

      if (options.unfold) {
        let obj;

        try {
          obj = JSON.parse(event.data);
        } catch (err) {}

        if (obj && isFSA(obj)) {
          // TODO: Consider optional prefix to incoming actions
          store.dispatch(obj);
        }
      }
    }

    return next => action => {
      if (action.type === `${ actionPrefix }${ SEND }`) {
        let { payload } = action;

        if (options.unfold && isFSA(payload)) {
          store.dispatch(payload);
          ws.send(JSON.stringify(payload));
        } else {
          ws.send(payload);
        }
      }

      return next(action);
    }
  };
}

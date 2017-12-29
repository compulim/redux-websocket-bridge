import blobToArrayBuffer from './blobToArrayBuffer';
import isFSA             from './isFSA';

export const CLOSE   = `CLOSE`;
export const MESSAGE = `MESSAGE`;
export const OPEN    = `OPEN`;
export const SEND    = `SEND`;

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
  binaryType  : 'arrayBuffer',
  unfold      : false
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
      let getPayload;

      if (typeof Blob !== 'undefined' && options.binaryType === 'arrayBuffer' && event.data instanceof Blob) {
        getPayload = blobToArrayBuffer(event.data);
      } else if (typeof ArrayBuffer !== 'undefined' && options.binaryType === 'blob' && event.data instanceof ArrayBuffer) {
        getPayload = new Blob([event.data]);
      } else {
        // We make this a Promise because we might want to keep the sequence of dispatch, @@websocket/MESSAGE first, then unfold later.
        getPayload = Promise.resolve(event.data);
      }

      getPayload.then(payload => {
        if (typeof payload === 'string' && options.unfold) {
          const action = tryParseJSON(payload);

          // TODO: Consider optional prefix to incoming actions
          isFSA(action) && store.dispatch(action);
        } else {
          store.dispatch({
            type: `${ actionPrefix }${ MESSAGE }`,
            payload
          });
        }
      });
    }

    return next => action => {
      if (action.type === `${ actionPrefix }${ SEND }`) {
        let { payload } = action;

        if (options.unfold && isFSA(payload)) {
          ws.send(JSON.stringify(payload));
        } else {
          ws.send(payload);
        }
      }

      return next(action);
    }
  };
}

function tryParseJSON(json) {
  try {
    return JSON.parse(json);
  } catch (err) {}
}

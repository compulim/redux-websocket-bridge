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
  binaryType: 'arraybuffer',
  namespace : '@@websocket/',
  unfold    : true
};

export default function createWebSocketMiddleware(urlOrFactory, options = DEFAULT_OPTIONS) {
  options = { ...DEFAULT_OPTIONS, ...options };
  options.binaryType = options.binaryType.toLowerCase();

  const { namespace } = options;

  return store => {
    let ws;

    if (typeof urlOrFactory === 'function') {
      ws = urlOrFactory();
    } else {
      ws = new WebSocket(urlOrFactory);
    }

    ws.onopen = () => store.dispatch({ type: `${ namespace }${ OPEN }` });
    ws.onclose = () => store.dispatch({ type: `${ namespace }${ CLOSE }` });
    ws.onmessage = event => {
      let getPayload;

      if (typeof Blob !== 'undefined' && options.binaryType === 'arraybuffer' && event.data instanceof Blob) {
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
          if (isFSA(action)) {
            return store.dispatch(action);
          }
        }

        store.dispatch({
          type: `${ namespace }${ MESSAGE }`,
          payload
        });
      });
    }

    return next => action => {
      if (action.type === `${ namespace }${ SEND }`) {
        ws.send(action.payload);
      } else if (action.meta && (action.meta.send === true || action.meta.send === namespace)) {
        const sendAction = {
          ...action,
          meta: { ...action.meta, send: undefined }
        };

        ws.send(JSON.stringify(sendAction));
      }

      return next(action);
    };
  };
}

function tryParseJSON(json) {
  try {
    return JSON.parse(json);
  } catch (err) {}
}

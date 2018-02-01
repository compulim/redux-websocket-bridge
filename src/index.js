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
  fold      : (action, webSocket) => {
    if (action.meta && arrayify(action.meta.send).some(send => send === true || send === webSocket)) {
      const { meta, ...actionWithoutMeta } = action;

      return JSON.stringify(actionWithoutMeta);
    }
  },
  meta      : {},
  namespace : '@@websocket/',
  unfold   : (payload, webSocket, raw) => {
    const action = tryParseJSON(payload);

    return action && {
      ...action,
      meta: {
        ...action.meta,
        webSocket
      }
    };
  }
};

function arrayify(obj) {
  return obj ? Array.isArray(obj) ? obj : [obj] : [];
}

export default function createWebSocketMiddleware(urlOrFactory, options = DEFAULT_OPTIONS) {
  options = { ...DEFAULT_OPTIONS, ...options };
  options.binaryType = options.binaryType.toLowerCase();
  options.unfold = options.unfold && (typeof options.unfold === 'function' ? options.unfold : DEFAULT_OPTIONS.unfold);

  const { namespace } = options;

  return store => {
    let webSocket;

    if (typeof urlOrFactory === 'function') {
      webSocket = urlOrFactory();
    } else {
      webSocket = new WebSocket(urlOrFactory);
    }

    webSocket.onopen = () => store.dispatch({ type: `${ namespace }${ OPEN }`, meta: { webSocket } });
    webSocket.onclose = () => store.dispatch({ type: `${ namespace }${ CLOSE }`, meta: { webSocket } });
    webSocket.onmessage = event => {
      let getPayload;

      if (typeof Blob !== 'undefined' && options.binaryType === 'arraybuffer' && event.data instanceof Blob) {
        getPayload = blobToArrayBuffer(event.data);
      } else if (typeof ArrayBuffer !== 'undefined' && options.binaryType === 'blob' && event.data instanceof ArrayBuffer) {
        getPayload = new Blob([event.data]);
      } else {
        // We make this a Promise because we might want to keep the sequence of dispatch, @@websocket/MESSAGE first, then unfold later.
        getPayload = Promise.resolve(event.data);
      }

      return getPayload.then(payload => {
        if (options.unfold) {
          const action = options.unfold(payload, webSocket, payload);

          if (action) {
            if (!isFSA(action)) {
              throw new Error('Unfolded action is not a Flux Standard Action compliant');
            }

            return action && store.dispatch(action);
          }
        }

        store.dispatch({
          type: `${ namespace }${ MESSAGE }`,
          meta: { webSocket },
          payload
        });
      });
    }

    return next => action => {
      if (action.type === `${ namespace }${ SEND }`) {
        webSocket.send(action.payload);
      } else {
        const payload = options.fold(action, webSocket);

        payload && webSocket.send(payload);
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

export function trimUndefined(map) {
  return Object.keys(map).reduce((nextMap, key) => {
    const value = map[key];

    if (typeof value !== 'undefined') {
      nextMap[key] = value;
    }

    return nextMap;
  }, {});
}

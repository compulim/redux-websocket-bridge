import minimatch         from 'minimatch';

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
  meta      : {
    from: true
  },
  namespace : '@@websocket/',
  tags      : [],
  unfold    : true
};

function defaultUnfold(payload, webSocket, options) {
  if (typeof payload === 'string') {
    const action = tryParseJSON(payload);

    // TODO: Consider optional prefix to incoming actions
    if (isFSA(action)) {
      const meta = { ...action.meta, ...options.meta };

      if (options.meta.from === true) {
        meta.from = webSocket;
      } else if (options.meta.from) {
        meta.from = options.meta.from;
      } else {
        delete meta.from;
      }

      return {
        ...action,
        meta
      };
    }
  }
}

function sendPredicate(sendMeta, webSocket, options) {
  if (!sendMeta) {
    return false;
  }

  sendMeta = Array.isArray(sendMeta) ? sendMeta : [sendMeta];

  return sendMeta.some(sendMeta =>
    sendMeta === true
    || sendMeta === webSocket
    || (options.tags || []).some(tag => {
      return typeof sendMeta === 'string' && minimatch(tag, sendMeta, { matchBase: true });
    })
  );
}

export default function createWebSocketMiddleware(urlOrFactory, options = DEFAULT_OPTIONS) {
  options = { ...DEFAULT_OPTIONS, ...options };
  options.binaryType = options.binaryType.toLowerCase();
  options.tags = Array.isArray(options.tags) ? options.tags : [options.tags];
  options.unfold = options.unfold && (typeof options.unfold === 'function' ? options.unfold : defaultUnfold);

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

      getPayload.then(payload => {
        if (options.unfold) {
          const action = options.unfold(payload, webSocket, options);

          if (action) {
            return store.dispatch(action);
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
      } else if (action.meta && sendPredicate(action.meta.send, webSocket, options)) {
        const { meta, ...actionToSend } = action;
        const { send, ...metaToSend } = meta;

        webSocket.send(JSON.stringify({
          ...actionToSend,
          ...Object.keys(metaToSend).length ? { meta: metaToSend } : {}
        }));
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

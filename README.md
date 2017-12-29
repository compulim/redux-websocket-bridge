# Bridge WebSocket messages and Redux actions

Inspired by [redux-websocket](https://github.com/giantmachines/redux-websocket).

This bridge middleware will:

* Dispatch WebSocket messages into Redux store
* Lift Redux action to WebSocket

## Introduction

WebSocket provides a full duplex connection. On top of request-response model, the server can watch-and-push to the browser continuously. But comparing coding effort between REST and WebSocket, fetching data using REST is much simpler.

We want to reduce the effort to consume APIs exposed thru WebSocket.

By combining WebSocket and Flux architecture (Redux), we found that the coding effort can be dramatically lowered to a level comparable to traditional REST APIs.

Thus, we made Redux WebSocket bridge. It promotes WebSocket messages to a first-class citizen in Flux architecture, enabling front end developers with less knowledge on WebSocket to work with new collaborative and reactive services.

## How to use

* [Add middleware to your store](#store-adding-middleware)
* [Handle incoming messages in reducer](#reducer-handling-incoming-messages)
* [Send WebSocket messages thru action](#action-sending-websocket-messages)

### Store: adding middleware

```js
import { applyMiddleware, createStore } from 'redux';
import ReduxWebSocketBridge from 'redux-websocket-bridge';

const createStoreWithMiddleware = applyMiddleware(
  ReduxWebSocketBridge('ws://localhost:4000/')
)(createStore);

export default createStoreWithMiddleware(...);
```

> Tips: you can use [`namespace`](#options) to add multiple `ReduxWebSocketBridge`

### Reducer: handling incoming messages

When you receive any WebSocket messages that resembles a [Flux Standard Action](https://github.com/acdlite/flux-standard-action) (FSA) in JSON, it will automatically parsed and dispatched to the store. We call this "unfold".

#### Server code

When the server send a JSON message that looks like a FSA, it will be automatically unfolded and dispatch to the store.

```js
app.on('connection', socket => {
  socket.write(JSON.stringify({
    type: 'SERVER/GREETING',
    payload: { version: '1.0.0' }
  }));
});
```

#### Client code

```js
function reducer(state = {}, action) {
  switch (action.type) {
  case 'SERVER/GREETING':
    return { ...state, ...action.payload, connected: true };

  default: break;
  }
}
```

#### Handling WebSocket events

For WebSocket events, they will be dispatched thru `@@websocket/*`.

```js
import { OPEN, CLOSE, MESSAGE } from 'redux-websocket-bridge';

function serverConnectivity(state = {}, action) {
  switch (action.type) {
  case `@@websocket/${ OPEN }`:
    state = { ...state, connected: true };
    break;

  case `@@websocket/${ CLOSE }`:
    state = { ...state, connected: false };
    break;

  case `@@websocket/${ MESSAGE }`:
    // Process the raw message here, either string, ArrayBuffer, or Blob
    break;

  default: break;
  }

  return state;
}
```

### Action: sending WebSocket messages

There are two ways to send WebSocket messages:

* [Send raw WebSocket message](#sending-raw-websocket-message)
* [Send action as JSON](#sending-action-as-json)

#### Sending raw WebSocket message

Payload will be send as-is without modifications. Depends on your WebSocket implementation, you may also send `ArrayBuffer` or `Blob`.

For example, to send a message thru [Slack RTM API](https://api.slack.com/rtm).

```js
import { SEND } from 'redux-websocket-bridge';

function sendHelloWorld() {
  return {
    type: `@@websocket/${ SEND }`,
    payload: JSON.stringify({
      id: 1,
      type: ' message',
      channel: 'C024BE91L',
      text: 'Hello world'
    })
  };
}
```

#### Sending action as JSON

> Using this feature will make your action not complies with FSA.

You can also opt-in to send any action dispatched to your store thru WebSocket. On the action object, set `meta.send` to `true` (or your namespace). When you dispatch the action, the bridge will also `JSON.stringify` and send a copy of the action to WebSocket.

```js
this.props.dispatch({
  type: 'CLIENT/SIGN_IN',
  meta: { send: true } // or '@@websocket',
  payload: { token: 'my very secret token' }
});
```

The action dispatched will be sent thru WebSocket similar to the following code. Note the `meta.send` property is stripped from the message and is not send across the wire.

```js
ws.send(JSON.stringify({
  type: 'CLIENT/SIGN_IN',
  payload: { token: 'my very secret token' }
}));
```

> Tips: you can also use the bridge on server-side to unfold messages back into a Redux store

> What-if: if your action is not a FSA-compliant, we will still send it thru. This behavior may change in the future.

## Advanced topics

* [Use SockJS or other implementations](#use-sockjs-or-other-implementations)
  * [WebSocket APIs used by the bridge](#websocket-apis-used-by-the-bridge)
* [Prefer `ArrayBuffer`](#prefer-arraybuffer)
* [Reconnection logic](#reconnection-logic)
* [Unfolding actions from multiple bridges](#unfolding-actions-from-multiple-bridges)
* [Delayed connectoin setup](#delayed-connection-setup)

### Use SockJS or other implementations

The bridge supports any libraries that adheres to WebSocket standard, for example, [SockJS](http://sockjs.org), which provides fallback for browser/proxy that does not support WebSocket.

```js
const createStoreWithMiddleware = applyMiddleware(
  WebSocketBridge(
    () => new SockJS('http://localhost:3000/ws/')
  )
)(createStore);
```

#### WebSocket APIs used by the bridge

Your WebSocket implementation will work on the bridge if they implemented the interface below:

```typescript
interface WebSocket {
  onopen();
  onclose();
  onmessage(event: { data: string });
  send(data: string);
}
```

> We currently do not process `onerror`, we might add it in near future.

### Prefer `ArrayBuffer`

> This feature is for browser only, it requires `FileReader` API

WebSocket support binary message. But receiving binary data means you might be receiving either `ArrayBuffer` or `Blob`, depends on your [WebSocket implementation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

For your convenience, if you set `binaryType` to `arraybuffer` in [options](#options), we will convert all `Blob` to `ArrayBuffer` before dispatching it to Redux store. Because the conversion is an asynchronous operation (using `FileReader`), it is easier for the bridge to convert it for you.

Vice versa, if you set `binaryType` to `blob`, we will convert all `ArrayBuffer` into `Blob`.

### Reconnection logic

For simplicity, the bridge does not have any reconnection mechanism. But it is easy to implement one, thanks to simple WebSocket API.

To implement your own reconnection logic, you can create a new WebSocket-alike. When disconnected, your implementation will recreate a new WebSocket object, which reconnect to your server. You will be managing the lifetime of WebSocket objects, event subscriptions, and resend backlog.

Although you are recommended to fully implement the [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), you can check out the [subset](#websocket-apis-used-by-the-bridge) required by the bridge.

### Unfolding actions from multiple bridges

We support multiple bridges. In rare cases, you may want to tag unfolded actions from multiple bridges. You can write a middleware between bridges to tag actions.

```js
const createStoreWithMiddleware = applyMiddleware(
  ReduxWebSocketBridge('ws://localhost:4000/'),
  store => next => action => {
    if (action === 'SERVER/GREETING') {
      action = { ...action, meta: { from: 'server1', ...action.meta } };
    }

    next(action);
  },
  ReduxWebSocketBridge('ws://localhost:4001/'),
  store => next => action => {
    if (action === 'SERVER/GREETING') {
      action = { ...action, meta: { from: 'server2', ...action.meta } };
    }

    next(action);
  },
)(createStore);
```

> For clarity, we did not refactor the sample code.

In this example, we added two middleware to tag all `SERVER/GREETING` action, adding a `meta.from` property indicate where the action was from. Note the order of spread/rest property matters, we will not overriding `meta.from` if it was already defined.

You can refactor the code out and use `RegExp` for pattern-matching action types.

If this sample does not works for you, please do [let us know](https://github.com/compulim/redux-websocket-action-bridge/issues).

### Delayed connection setup

Some services requires calling their REST API before setting up a WebSocket connection, for example, Slack requires a handshake call [`rtm.connect`](https://api.slack.com/methods/rtm.connect) to get the endpoint for their WebSocket RTM API.

You can create a WebSocket-alike to do the REST API handshake. Once your handshake is done, you can then establish the WebSocket connection. You will need to proxy events before the connection is made. But since the bridge prefer `onopen` than `addEventListener`, the effort is minimal.

## Options

| Name | Description | Default |
| - | - | - |
| `binaryType` | Convert binary to `"arraybuffer"` or `"blob"` | `null` |
| `namespace` | Action prefix for all system messages | `"@@websocket/"` |
| `unfold` | Unfold messages as actions if they are JSON and look like a [Flux Standard Action](https://github.com/acdlite/flux-standard-action) | `true` |

## Contributions

Like us? [Star](https://github.com/compulim/redux-websocket-action-bridge/stargazers) us.

Something not right? File us an [issue](https://github.com/compulim/redux-websocket-action-bridge/issues).

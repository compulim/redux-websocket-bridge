# Unfolds and dispatches WebSocket messages into Redux

Inspired by [redux-websocket](https://github.com/giantmachines/redux-websocket).

This bridge middleware will:

* Dispatches WebSocket messages into Redux store
  * Unfold as a Redux action
  * As `@@websocket/MESSAGE`, `payload` could be text or binary
* Pumps Redux action payload to WebSocket
  * Set `send` to `true` to any action
  * Thru `@@websocket/SEND` action, `payload` will send as-is

## How to use

* [Add middleware to your store](#store-adding-middleware)
* [Handle incoming messages in reducer](#reducer-handling-incoming-messages)
* [Send WebSocket messages thru action](#action-sending-websocket-messages)

### Store: adding middleware

```js
import { applyMiddleware, createStore } from 'redux';
import ReduxWebSocketBridge from 'redux-websocket-bridge';

const createStoreWithMiddleware = applyMiddleware(
  ReduxWebSocketBridge('ws://localhost:4000/', { unfold: true })
)(createStore);

export default createStoreWithMiddleware(...);
```

> Tips: you can use [`namespace`](#options) to add multiple `ReduxWebSocketBridge`

### Reducer: handling incoming messages

With unfolding enabled, when you receive any WebSocket messages that resembles a [Flux Standard Action](https://github.com/acdlite/flux-standard-action) (FSA) in JSON, it will automatically parsed and dispatched to the store.

#### Server code

When the server send a JSON message that looks like a FSA, it will automatically unfolded and dispatch to the store.

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
    return { ...state, connected: true };

  default: break;
  }
}
```

#### Handling WebSocket events

For WebSocket events, they will be dispatched thru `@@websocket/*.

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

You can also opt-in to send any action dispatched to your store thru WebSocket. On the action object, set `send` to `true` (or your namespace). When you dispatch the action, the bridge will also `JSON.stringify` and send the action to WebSocket.

```js
this.props.dispatch({
  type: 'CLIENT/SIGN_IN',
  payload: { token: 'my very secret token' },
  send: true
});
```

The action dispatched will be sent thru WebSocket similar to the following code. Note the `send` property is stripped from the message to make the JSON message complies to FSA.

```js
ws.send(JSON.stringify({
  type: 'CLIENT/SIGN_IN',
  payload: { token: 'my very secret token' }
}));
```

> Tips: if you have multiple bridges, you can set `send` to `@@websocket` to send thru only the bridge with the same namespace.

> What-if: if your action is not a FSA-compliant, we will still send it thru. This behavior may change in the future.

## Advanced topics

* [Use SockJS or other implementations](#use-sockjs-or-other-implementations)
  * [WebSocket APIs used by the bridge](#websocket-apis-used-by-the-bridge)
* [Prefer `ArrayBuffer`](#prefer-arraybuffer)
* [Reconnection logic](#reconnection-logic)
* [Unfolding actions from multiple bridges](#unfolding-actions-from-multiple-bridges)

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

If you are unsure if your WebSocket implementation will work on the bridge or not, check it against the list of required WebSocket APIs list below:

* `onopen`
* `onclose`
* `onmessage(event)`
  * `event.data`
    * Unfold enabled: it should support returning `string`
* `send`
  * Unfold enabled: it should support sending `string`

### Prefer `ArrayBuffer`

WebSocket standard support sending binary data. But receiving binary data means you might be receiving either `ArrayBuffer` or `Blob`, depends on your [WebSocket implementation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

For your convenience, if you set `binaryType` to `arraybuffer` in [options](#options), we will convert all `Blob` to `ArrayBuffer` before dispatching it to Redux store. Because the conversion is an asynchronous operation (using `FileReader`), it is easier for the bridge to convert it for you.

Vice versa, if you set `binaryType` to `blob`, we will convert all `ArrayBuffer` into `Blob`.

### Reconnection logic

For simplicity, the bridge does not have any reconnection mechanism. But it is simple to implement one, thanks to simple WebSocket API.

To implement your own reconnection logic, you can create a new WebSocket-alike. When disconnected, your implementation will recreate a new WebSocket object. You will be managing the lifetime of WebSocket objects and event subscription.

Although you are recommended to fully implement the [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), you can check out [list of APIs](#websocket-apis-used-by-the-bridge) that is required by the bridge.

### Unfolding actions from multiple bridges

We support multiple bridges. In rare cases, you may be unfolding action with same action type from multiple bridges, and you want to differentiate them.

In Redux, every action should be a FSA-compliant, we prefer to keep it that way. You can add middleware between bridges to tag messages from them.

```js
const createStoreWithMiddleware = applyMiddleware(
  ReduxWebSocketBridge('ws://localhost:4000/'),
  store => next => action => {
    if (action === 'SERVER/GREETING') {
      action = { ...action, payload: { from: 'server1', ...action.payload } };
    }

    next(action);
  },
  ReduxWebSocketBridge('ws://localhost:4001/'),
  store => next => action => {
    if (action === 'SERVER/GREETING') {
      action = { ...action, payload: { from: 'server2', ...action.payload } };
    }

    next(action);
  },
)(createStore);
```

In this example, we added two middleware to tag all `SERVER/GREETING` action, adding a `from` property to `payload` to indicate if it is from `server1` or `server2`. Note the order of spread/rest property matters, we will not overriding `payload.from` if already there.

You can refactor the code out and use `RegExp` for matching action types.

If this sample doesn't works for you, please do [let us know](https://github.com/compulim/redux-websocket-action-bridge/issues).

## Options

| Name | Description | Default |
| - | - | - |
| `actionPrefix` | Action prefix for all system messages | `"@@websocket/"` |
| `binaryType` | Convert binary to `"arraybuffer"` or `"blob"` | `null` |
| `unfold` | Unfold messages as actions if they are JSON and look like a [Flux Standard Action](https://github.com/acdlite/flux-standard-action), and vice versa | `true` |

## Contributions

Like us? [Star](https://github.com/compulim/redux-websocket-action-bridge/stargazers) us.

Something not right? File us an [issue](https://github.com/compulim/redux-websocket-action-bridge/issues).

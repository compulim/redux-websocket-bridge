# Redux WebSocket to action bridge

Inspired by [redux-websocket](https://github.com/giantmachines/redux-websocket).

This bridge middleware will:

* Pumps messages from Web Socket into Redux actions
* Pumps Redux actions into Web Socket messages

## How to use

* [Store](#store)
* [Reducer](#reducer)
* [Action](#action)

### Store

```js
import { applyMiddleware, createStore } from 'redux';
import WebSocketActionBridge from 'redux-websocket-action-bridge';

const createStoreWithMiddleware = applyMiddleware(
  WebSocketActionBridge(
    () => new WebSocket('ws://localhost:4000'),
    {
      actionPrefix: '@@websocket/',
      unfold: false
    }
  )
)(createStore);

export default createStore(...);
```

When you create the store, you can add one or more instances of `WebSocketActionBridge` thru `applyMiddleware`.

### Reducer

```js
import { OPEN, CLOSE, MESSAGE } from 'redux-websocket-action-bridge';

function serverConnectivity(state = {}, action) {
  switch (action.type) {
  case `@@websocket/${ OPEN }`:
    state = { ...state, connected: true };
    break;

  case `@@websocket/${ CLOSE }`:
    state = { ...state, connected: false };
    break;

  case `@@websocket/${ MESSAGE }`:
    // Process the raw message here
    break;

  default: break;
  }

  return state;
}
```

When an event is received thru the Web Socket, it will be dispatched into the store as one of the actions below:

```json
// When the socket is connected
{
  "type": "@@websocket/OPEN"
}
```

```json
// When the socket is disconnected
{
  "type": "@@websocket/CLOSE"
}
```

```json
// When the socket received a message, the payload is a string
{
  "type": "@@websocket/MESSAGE",
  "payload": "<Raw message here>"
}
```

### Action

To send a message, you dispatch an action with `string` as the payload. By default, the action type is `@@websocket/SEND`.

```js
import { SEND } from 'redux-websocket-action-bridge';

function fetchServerVersion() {
  return { type: `@@websocket/${ SEND }`, payload: '<Raw message here>' };
}
```

> If `options.unfold` is set to true and `payload` looks like a [Flux Standard Action](https://github.com/acdlite/flux-standard-action), it will be dispatched locally too.

## Advanced topics

* [Dispatching message as action](#dispatching-message-as-action)
* [Use SockJS](#use-sockjs)

### Dispatching message as action

Instead of dispatching as a generic `@@websocket/MESSAGE` action with `string` as payload, the bridge can automatically unfold the payload if it is a JSON and looks like a [Flux Standard Action](https://github.com/acdlite/flux-standard-action).

By unfolding Redux actions, you can reduce code and create interesting code pattern. For example, server can send greeting action on connect.

```js
ws.on('connection', socket => {
  socket.write(JSON.stringify({
    type: 'SERVER/VERSION',
    payload: {
      platform: require('os').platform,
      version: require('./package.json').version
    }
  }));
});
```

Unfold also applies when you are sending out a JavaScript object that looks like an action.

```js
this.props.dispatch(send({
  type: 'CLIENT/SIGN_IN',
  payload: { username, token }
}));
```

It will both dispatch the action locally, and send it over WebSocket in JSON format.

### Use SockJS

The action bridge supports any libraries that adheres to WebSocket standard, for example, [SockJS](http://sockjs.org), which provides fallback for browser that does not support Web Socket.

```js
const createStoreWithMiddleware = applyMiddleware(
  WebSocketActionBridge(
    () => new WebSocket('ws://localhost:4000'),
    {
      actionPrefix: '@@websocket/',
      unfold: false
    }
  )
)(createStore);
```

## Options

| Name | Description | Default |
| - | - | - |
| `actionPrefix` | Action prefix for all system messages | `"@@websocket/"` |
| `binaryType` | Convert binary to `arrayBuffer` or `blob` | `null` |
| `unfold` | Unfold message as an action object if they are JSON and looks like a [Flux Standard Action](https://github.com/acdlite/flux-standard-action), and vice versa | `false` |

## Contributions

Like us? [Star](https://github.com/compulim/redux-websocket-action-bridge/stargazers) us.

Something not right? File us an [issue](https://github.com/compulim/electron-ipcrenderer-websocket/issues).

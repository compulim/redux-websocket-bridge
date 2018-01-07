const { applyMiddleware, createStore: createReduxStore } = require('redux');
const { default: createSagaMiddleware }                  = require('redux-saga');
const { default: createReduxWebSocketBridge }            = require('redux-websocket-bridge');
const sagas                                              = require('./sagas');

module.exports = function createStore(ws) {
  const sagaMiddleware = createSagaMiddleware();
  const store = applyMiddleware(
    createReduxWebSocketBridge(() => ws),
    sagaMiddleware
  )(createReduxStore)((state = {}) => state);

  sagaMiddleware.run(sagas);

  return store;
}

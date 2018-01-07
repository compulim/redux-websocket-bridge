module.exports = function *sagas() {
  yield* require('./ping')();
}

const { effects } = require('redux-saga');
const packageJSON = require('../../package.json');

const { put, takeEvery } = effects;

module.exports = function *pingSaga() {
  yield takeEvery('SERVER/PING', ping);
}

function* ping(action) {
  yield put({
    type: '@@websocket/SEND',
    payload: 'This is a raw message from server'
  });

  yield put({
    type: '@@websocket/SEND',
    payload: Buffer.from('BINARY')
  });

  yield put({
    type: 'SERVER/ALIVE',
    meta: {
      send: true
    },
    payload: {
      now: new Date().toISOString(),
      version: packageJSON.version
    }
  });
}

module.exports.ping = ping;

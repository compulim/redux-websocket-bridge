const http = require('http');
const WebSocket = require('ws');
const createStore = require('./createStore');

const port = process.env.PORT || 4000;
const wss = new WebSocket.Server({ port });

wss.on('connection', ws => {
  console.log('Client connected');

  ws.on('error', err => {
    console.error(err);
  });

  ws.on('close', err => {
    console.log('Client closed');
  });

  ws.on('message', data => {
    console.log(data);
  });

  createStore(ws);
});

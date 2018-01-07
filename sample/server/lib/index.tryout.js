const WebSocket = require('ws');

const ws = new WebSocket('http://localhost:4000/');

ws.on('open', () => {
  console.log('Connection opened');

  ws.on('message', message => {
    try {
      const action = JSON.parse(message);

      console.log(action);

      action.type === 'SERVER/ALIVE' && ws.close();
    } catch (err) {
      console.log(message);
    }
  });

  ws.on('close', () => {
    console.log('Connection closed');
  });

  ws.send('This is a raw message from client');
  ws.send(Buffer.from('BINARY'));

  ws.send(JSON.stringify({
    type: 'SERVER/PING'
  }));
});

// Minimal WebSocket + HTTP server for AWS Elastic Beanstalk (AL2 Node.js platform)
// Uses 'ws' and Express. Listens on process.env.PORT as required by EB.
var sudoku = require('./sudoku');
var _ = require('lodash');

const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();

// Basic healthcheck endpoint for EB
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const server = http.createServer(app);

// Create a WebSocket server that shares the same HTTP server
const wss = new WebSocketServer({ noServer: false, port: process.env.PORT || 8082 });

var puzzle;

wss.on('connection', (ws, request) => {
  
  if(wss.clients.size >= 2){
    puzzle = sudoku.makepuzzle();
    var puzzleSerialized = JSON.stringify(puzzle);
    wss.clients.forEach(c => c.send(puzzleSerialized));
  }

  ws.on('message', (data) => {
    // Simple echo with timestamp
    var serialized = data.toString();
    console.log(serialized);
    var deserialized = JSON.parse(serialized);
    if(deserialized != null){
      var solved = sudoku.solvepuzzle(puzzle);
      var success = _.isEqual(solved, deserialized.puzzle)
      var result = {
        username: deserialized.username,
        isWinner: success,
      };
      // if(!success) {
      //   wss.clients.forEach(c => c.send("Wrong guess: " + deserialized.username));
      //   return;
      // }
      wss.clients.forEach(c => c.send(JSON.stringify(result)));
    }
  });

  // keepalive ping/pong
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('close', () => clearInterval(interval));
});

// Upgrade HTTP -> WS
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});


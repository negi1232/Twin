const http = require('http');
const fs = require('fs');
const path = require('path');

function createServer(port, htmlFile) {
  const html = fs.readFileSync(path.join(__dirname, htmlFile), 'utf-8');
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function startServers() {
  const expected = await createServer(3100, 'expected.html');
  const actual = await createServer(3101, 'actual.html');
  return { expected, actual };
}

function stopServers(...servers) {
  return Promise.all(
    servers.map(
      (s) =>
        new Promise((resolve) => {
          s.close(resolve);
        })
    )
  );
}

module.exports = { createServer, startServers, stopServers };

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

async function startDemoServers() {
  const expected = await createServer(3200, 'demo-expected.html');
  const actual = await createServer(3201, 'demo-actual.html');
  return { expected, actual };
}

function createApiServer(port, htmlFile) {
  const html = fs.readFileSync(path.join(__dirname, htmlFile), 'utf-8');

  const apiRoutes = {
    'GET /api/users': { status: 200, body: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
    'GET /api/posts': { status: 200, body: [{ id: 1, title: 'Hello World' }] },
    'POST /api/auth/login': { status: 200, body: { token: 'test-token-123' } },
  };

  const server = http.createServer((req, res) => {
    const key = `${req.method} ${req.url.split('?')[0]}`;
    const route = apiRoutes[key];
    if (route) {
      res.writeHead(route.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(route.body));
      return;
    }
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

async function startTwinAppServers() {
  const expected = await createServer(3500, 'expected.html');
  const actual = await createServer(3501, 'actual.html');
  return { expected, actual };
}

async function startFileUploadServers() {
  const expected = await createServer(3300, 'file-upload.html');
  const actual = await createServer(3301, 'file-upload.html');
  return { expected, actual };
}

async function startApiMockServers() {
  const expected = await createApiServer(3400, 'api-mock-page.html');
  const actual = await createApiServer(3401, 'api-mock-page.html');
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

module.exports = { createServer, createApiServer, startServers, startDemoServers, startTwinAppServers, startFileUploadServers, startApiMockServers, stopServers };

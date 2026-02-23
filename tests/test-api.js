const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
let serverProcess;

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ 
            status: res.statusCode, 
            headers: res.headers, 
            body: json 
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('API Tests', async () => {
  before(async () => {
    console.log('Starting test server...');
    serverProcess = spawn('node', ['server.js'], {
      env: { ...process.env, NODE_ENV: 'test', PORT: PORT.toString() },
      stdio: 'pipe'
    });

    // Ждем запуска сервера
    let attempts = 0;
    while (attempts < 20) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`${BASE_URL}/api/auth/me`, (res) => {
            if (res.statusCode) resolve();
            else reject();
          });
          req.on('error', reject);
          req.end();
        });
        console.log('Server is ready');
        return;
      } catch (err) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }
    }
    throw new Error('Сервер не запустился');
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('должен создать новую заявку', async () => {
    const response = await fetchJson(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        clientName: 'Тест Клиент',
        phone: '+7 999 123-45-67',
        address: 'ул. Тестовая, д. 1',
        problemText: 'Тестовая проблема'
      }
    });

    assert.strictEqual(response.status, 201);
    assert.ok(response.body.id);
  });

  it('должен вернуть ошибку при создании заявки без обязательных полей', async () => {
    const response = await fetchJson(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        clientName: 'Тест Клиент'
      }
    });

    assert.strictEqual(response.status, 400);
    assert.ok(response.body.error);
  });
});
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');

const PORT = 3002;
const BASE_URL = `http://localhost:${PORT}`;
let serverProcess;

// Та же вспомогательная функция
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { ...options, method: options.method || 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json });
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

describe('Race Condition Tests', async () => {
  let cookie;
  let targetRequestId;

  before(async () => {
    // Запускаем сервер
    serverProcess = spawn('node', ['server.js'], {
      env: { ...process.env, NODE_ENV: 'test', PORT: PORT.toString() },
      stdio: 'pipe'
    });

    // Ждем запуска
    await new Promise(r => setTimeout(r, 1000));

    // Логинимся как мастер
    const loginRes = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'master1' }
    });

    // Получаем cookie из заголовков
    const setCookie = loginRes.headers['set-cookie'];
    if (setCookie) {
      cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    }

    // Создаем заявку и назначаем её на мастера через диспетчера
    // Сначала логинимся как диспетчер
    const dispatcherLogin = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'dispatcher' }
    });
    
    const dispatcherCookie = dispatcherLogin.headers['set-cookie'];

    // Создаем заявку
    const createRes = await fetchJson(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': dispatcherCookie 
      },
      body: {
        clientName: 'Race Test',
        phone: '123',
        address: 'Race Address',
        problemText: 'Race Problem'
      }
    });
    
    const requestId = createRes.body.id;

    // Назначаем мастера
    await fetchJson(`${BASE_URL}/api/requests/${requestId}/assign`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': dispatcherCookie 
      },
      body: { masterId: 2 } // master1 имеет id 2
    });

    targetRequestId = requestId;
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('должен обработать параллельные запросы на взятие заявки', async () => {
    // Отправляем 3 параллельных запроса
    const requests = Array(3).fill().map(() => 
      fetchJson(`${BASE_URL}/api/requests/${targetRequestId}/take`, {
        method: 'PATCH',
        headers: { 'Cookie': cookie }
      })
    );

    const results = await Promise.all(requests);
    
    // Считаем результаты
    const successCount = results.filter(r => r.status === 200).length;
    const conflictCount = results.filter(r => r.status === 409).length;

    console.log(`Результаты гонки: ${successCount} успешно, ${conflictCount} с конфликтом`);

    // Должен быть ровно один успешный запрос
    assert.strictEqual(successCount, 1);
    // Остальные должны быть с конфликтом
    assert.strictEqual(conflictCount, 2);
  });
});
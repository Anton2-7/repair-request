const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка сессий
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Определяем путь к БД
const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Инициализация БД из SQL-файлов
const initDb = () => {
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const seedsPath = path.join(__dirname, 'db', 'seeds.sql');
    
    console.log('Looking for schema at:', schemaPath);
    console.log('Looking for seeds at:', seedsPath);
    
    if (!fs.existsSync(schemaPath)) {
      console.error('schema.sql not found at:', schemaPath);
      return;
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    db.exec(schema, (err) => {
      if (err) {
        console.error('Schema error:', err);
      } else {
        console.log('Schema created successfully');
        
        if (fs.existsSync(seedsPath)) {
          const seeds = fs.readFileSync(seedsPath, 'utf8');
          db.exec(seeds, (err) => {
            if (err) {
              console.error('Seeds error:', err);
            } else {
              console.log('Seeds loaded successfully');
            }
          });
        } else {
          console.log('No seeds.sql found, skipping seeds');
        }
      }
    });
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

initDb();

// Middleware проверки авторизации
function authMiddleware(roles = []) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    if (roles.length && !roles.includes(req.session.userRole)) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    next();
  };
}

// ========== API ==========

// Логин (упрощённый)
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.full_name;
    res.json({ role: user.role, name: user.full_name });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  res.json({
    id: req.session.userId,
    role: req.session.userRole,
    name: req.session.userName
  });
});

// Список мастеров (диспетчер)
app.get('/api/masters', authMiddleware(['dispatcher']), (req, res) => {
  db.all("SELECT id, full_name FROM users WHERE role = 'master'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ========== ОСНОВНЫЕ ЗАЯВКИ (без архива) ==========

// Получить заявки (исключая архивные)
app.get('/api/requests', authMiddleware(), (req, res) => {
  const { status } = req.query;
  const userId = req.session.userId;
  const role = req.session.userRole;

  console.log('GET /api/requests - status:', status, 'role:', role, 'userId:', userId);

  let sql = "SELECT r.*, u.full_name as masterName FROM requests r LEFT JOIN users u ON r.assignedTo = u.id";
  const params = [];

  // Исключаем архивные заявки из основного списка
  let whereClause = " WHERE r.status != 'deleted'";

  if (role === 'master') {
    whereClause += " AND r.assignedTo = ?";
    params.push(userId);
    
    if (status && status !== '') {
      whereClause += " AND r.status = ?";
      params.push(status);
    }
  } else {
    if (status && status !== '') {
      whereClause += " AND r.status = ?";
      params.push(status);
    }
  }

  sql += whereClause;
  sql += " ORDER BY r.createdAt DESC";

  console.log('SQL:', sql);
  console.log('Params:', params);

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log(`Found ${rows.length} active requests`);
    res.json(rows);
  });
});

// Создать заявку (доступно всем)
app.post('/api/requests', (req, res) => {
  const { clientName, phone, address, problemText } = req.body;
  if (!clientName || !phone || !address || !problemText) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }
  db.run(
    `INSERT INTO requests (clientName, phone, address, problemText, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'new', datetime('now'), datetime('now'))`,
    [clientName, phone, address, problemText],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// Назначить мастера (диспетчер)
app.patch('/api/requests/:id/assign', authMiddleware(['dispatcher']), (req, res) => {
  const { id } = req.params;
  const { masterId } = req.body;
  if (!masterId) return res.status(400).json({ error: 'masterId обязателен' });
  db.run(
    `UPDATE requests SET assignedTo = ?, status = 'assigned', updatedAt = datetime('now')
     WHERE id = ? AND status IN ('new', 'assigned')`,
    [masterId, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(409).json({ error: 'Заявка не может быть назначена' });
      }
      res.json({ success: true });
    }
  );
});

// Отменить заявку (диспетчер)
app.patch('/api/requests/:id/cancel', authMiddleware(['dispatcher']), (req, res) => {
  const { id } = req.params;
  db.run(
    `UPDATE requests SET status = 'canceled', updatedAt = datetime('now')
     WHERE id = ? AND status != 'done' AND status != 'deleted'`,
    [id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(409).json({ error: 'Нельзя отменить выполненную или архивную заявку' });
      }
      res.json({ success: true });
    }
  );
});

// Взять в работу (мастер) – атомарная операция
app.patch('/api/requests/:id/take', authMiddleware(['master']), (req, res) => {
  const { id } = req.params;
  const masterId = req.session.userId;
  db.run(
    `UPDATE requests SET status = 'in_progress', updatedAt = datetime('now')
     WHERE id = ? AND status = 'assigned' AND assignedTo = ?`,
    [id, masterId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(409).json({ error: 'Заявка уже взята другим мастером или недоступна' });
      }
      res.json({ success: true });
    }
  );
});

// Завершить заявку (мастер)
app.patch('/api/requests/:id/complete', authMiddleware(['master']), (req, res) => {
  const { id } = req.params;
  const masterId = req.session.userId;
  db.run(
    `UPDATE requests SET status = 'done', updatedAt = datetime('now')
     WHERE id = ? AND status = 'in_progress' AND assignedTo = ?`,
    [id, masterId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(409).json({ error: 'Нельзя завершить эту заявку' });
      }
      res.json({ success: true });
    }
  );
});

// ========== РАБОТА С АРХИВОМ ==========

// Отправить в архив (мягкое удаление) - только для выполненных или отмененных
app.patch('/api/requests/:id/archive', authMiddleware(['dispatcher']), (req, res) => {
    const { id } = req.params;
    
    console.log(`📦 Архивация заявки ${id}`);
    
    db.run(
        `UPDATE requests SET status = 'deleted', updatedAt = datetime('now')
         WHERE id = ? AND status IN ('done', 'canceled')`,
        [id],
        function(err) {
            if (err) {
                console.error('Archive error:', err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(409).json({ error: 'В архив можно отправить только выполненные или отмененные заявки' });
            }
            console.log(`✅ Заявка ${id} отправлена в архив`);
            res.json({ success: true, message: 'Заявка отправлена в архив' });
        }
    );
});

// Получить только архивные заявки
app.get('/api/requests/archived', authMiddleware(['dispatcher']), (req, res) => {
    console.log('📋 Запрос архивных заявок');
    
    db.all(
        `SELECT r.*, u.full_name as masterName 
         FROM requests r 
         LEFT JOIN users u ON r.assignedTo = u.id 
         WHERE r.status = 'deleted'
         ORDER BY r.updatedAt DESC`,
        [],
        (err, rows) => {
            if (err) {
                console.error('Error loading archived:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log(`✅ Найдено ${rows.length} архивных заявок`);
            res.json(rows);
        }
    );
});

// Восстановить из архива
app.patch('/api/requests/:id/restore', authMiddleware(['dispatcher']), (req, res) => {
    const { id } = req.params;
    
    console.log(`🔄 Восстановление заявки ${id} из архива`);
    
    db.run(
        `UPDATE requests SET status = 'done', updatedAt = datetime('now')
         WHERE id = ? AND status = 'deleted'`,
        [id],
        function(err) {
            if (err) {
                console.error('Restore error:', err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Заявка не найдена в архиве' });
            }
            console.log(`✅ Заявка ${id} восстановлена из архива`);
            res.json({ success: true, message: 'Заявка восстановлена из архива' });
        }
    );
});

// Получить статистику по заявкам
app.get('/api/requests/stats', authMiddleware(['dispatcher']), (req, res) => {
    db.all(
        `SELECT status, COUNT(*) as count 
         FROM requests 
         GROUP BY status`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const stats = {
                new: 0,
                assigned: 0,
                in_progress: 0,
                done: 0,
                canceled: 0,
                deleted: 0
            };
            
            rows.forEach(row => {
                stats[row.status] = row.count;
            });
            
            res.json(stats);
        }
    );
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`DB Path: ${dbPath}`);
});
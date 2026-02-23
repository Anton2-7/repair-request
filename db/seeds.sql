-- Сиды: тестовые пользователи и заявки
INSERT OR IGNORE INTO users (username, role, full_name) VALUES
  ('dispatcher', 'dispatcher', 'Диспетчер'),
  ('master1', 'master', 'Иванов Иван'),
  ('master2', 'master', 'Петров Пётр');

-- Несколько заявок для демонстрации (назначаем на master1 для теста гонки)
INSERT OR IGNORE INTO requests (clientName, phone, address, problemText, status, assignedTo, createdAt, updatedAt)
SELECT 'Клиент A', '111-111', 'ул. Ленина 1', 'Не включается', 'assigned', u.id, datetime('now'), datetime('now')
FROM users u WHERE u.username = 'master1' AND NOT EXISTS (SELECT 1 FROM requests WHERE id = 1);

INSERT OR IGNORE INTO requests (clientName, phone, address, problemText, status, createdAt, updatedAt)
SELECT 'Клиент B', '222-222', 'ул. Мира 2', 'Шумит', 'new', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE id = 2);

INSERT OR IGNORE INTO requests (clientName, phone, address, problemText, status, assignedTo, createdAt, updatedAt)
SELECT 'Клиент C', '333-333', 'пр. Победы 3', 'Течёт', 'in_progress', u.id, datetime('now'), datetime('now')
FROM users u WHERE u.username = 'master2' AND NOT EXISTS (SELECT 1 FROM requests WHERE id = 3);
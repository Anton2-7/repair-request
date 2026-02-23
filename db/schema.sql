-- Создание таблиц
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  role TEXT CHECK(role IN ('dispatcher','master')),
  full_name TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clientName TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  problemText TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  assignedTo INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(assignedTo) REFERENCES users(id)
);
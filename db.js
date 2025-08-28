const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

// SQLite setup (moved from index.js)
const DB_FILE = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(DB_FILE);
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

async function initDb() {
  await dbRun(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`);

  const row = await dbGet('SELECT COUNT(*) AS count FROM posts');
  if ((row && row.count) === 0) {
    const authors = ['관리자', '홍길동', '임꺽정', '이몽룡', '성춘향'];
    const seed = [];
    for (let i = 1; i <= 35; i++) {
      const title = `샘플 글 ${i}`;
      const content = `이것은 샘플 게시글 #${i} 입니다. SQLite 시드 데이터입니다.`;
      const author = authors[(i - 1) % authors.length];
      const createdAt = new Date(Date.now() - i * 3600000).toISOString(); // i시간 전으로 분산
      seed.push([title, content, author, createdAt]);
    }
    for (const [title, content, author, createdAt] of seed) {
      await dbRun('INSERT INTO posts (title, content, author, createdAt) VALUES (?, ?, ?, ?)', [title, content, author, createdAt]);
    }
    console.log('Seeded posts table with 35 sample rows.');
  }
}

function closeDb() {
  try {
    db.close();
  } catch (_) {}
}

module.exports = {
  DB_FILE,
  db,
  dbRun,
  dbGet,
  dbAll,
  initDb,
  closeDb,
};
// Board-related data access functions
// This module isolates SQL queries for the board domain.

const { dbGet, dbAll, dbRun } = require('./db');

async function countPosts() {
  const row = await dbGet('SELECT COUNT(*) AS count FROM posts');
  return row ? row.count : 0;
}

async function listPosts(limit, offset) {
  return dbAll(
    'SELECT id, title, content, author, createdAt FROM posts ORDER BY id LIMIT ? OFFSET ?',
    [limit, offset]
  );
}

async function getPostById(id) {
  return dbGet('SELECT id, title, content, author, createdAt FROM posts WHERE id = ?', [id]);
}

async function createPost({ title, content, author }) {
  const createdAt = new Date().toISOString();
  const sql = 'INSERT INTO posts (title, content, author, createdAt) VALUES (?, ?, ?, ?)';
  // sqlite3 run doesn't return lastID via promisify, so we can wrap it manually using db.run directly via dbRun with function context preserved in db.js.
  // Our dbRun returns a Statement-like object but doesn't expose lastID. We will execute a two-step: run insert, then get last row id via SELECT last_insert_rowid().
  await dbRun(sql, [title, content, author, createdAt]);
  const row = await dbGet('SELECT last_insert_rowid() AS id');
  return row && row.id;
}

async function updatePost(id, { title, content, author }) {
  const sql = 'UPDATE posts SET title = ?, content = ?, author = ? WHERE id = ?';
  const res = await dbRun(sql, [title, content, author, id]);
  // We cannot rely on changes count due to promisify limitations; just return boolean by checking post existence separately if needed by caller.
  return true;
}

module.exports = {
  countPosts,
  listPosts,
  getPostById,
  createPost,
  updatePost,
};

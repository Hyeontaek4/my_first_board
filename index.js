const express = require('express');
const path = require('path');
const { dbGet, initDb, closeDb } = require('./db');
const boardDataSource = require('./boardDataSource');

const app = express();
const PORT = process.env.PORT || 3000;

// Built-in middleware to parse JSON
app.use(express.json());
// Parse application/x-www-form-urlencoded (HTML form posts)
app.use(express.urlencoded({ extended: false }));

// View engine (EJS) setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static assets (CSS, images, etc.) from /public
app.use(express.static(path.join(__dirname, 'public')));

// Database is now managed in ./db.js

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Root route
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

// Health check route
app.get('/health', async (req, res) => {
  try {
    const row = await dbGet('SELECT 1 AS ok');
    res.json({ status: 'ok', db: row && row.ok === 1 ? 'ok' : 'unknown' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'error', message: e.message });
  }
});

// GET /board/list - list posts (HTML only)
app.get('/board/list', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '10', 10) || 10, 1), 50);
    const offset = (page - 1) * pageSize;

    const total = await boardDataSource.countPosts();
    const rows = await boardDataSource.listPosts(pageSize, offset);

    const hasPrev = page > 1;
    const hasNext = page * pageSize < total;
    const prevPage = page - 1;
    const nextPage = page + 1;

    return res.render('board-list', {
      total,
      page,
      pageSize,
      posts: rows,
      hasPrev,
      hasNext,
      prevPage,
      nextPage,
    });
  } catch (err) {
    console.error('Error fetching posts list:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /board/list/:id - get post by id (HTML only)
app.get('/board/list/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).render('board-detail', { post: null });
    }
    const post = await boardDataSource.getPostById(id);
    if (!post) {
      return res.status(404).render('board-detail', { post: null });
    }

    return res.render('board-detail', {
      post,
      createdAt: new Date(post.createdAt).toLocaleString(),
    });
  } catch (err) {
    console.error('Error fetching post by id:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Validation helper
function validatePostInput(body) {
  const errors = {};
  const title = (body.title || '').toString().trim();
  const content = (body.content || '').toString().trim();
  const author = (body.author || '').toString().trim();

  if (!title) errors.title = '제목을 입력해 주세요.';
  if (!content) errors.content = '내용을 입력해 주세요.';
  if (!author) errors.author = '작성자를 입력해 주세요.';

  if (title.length > 200) errors.title = '제목은 200자 이하여야 합니다.';
  if (author.length > 100) errors.author = '작성자는 100자 이하여야 합니다.';

  return { errors, values: { title, content, author } };
}

// GET /board/new - render create form
app.get('/board/new', (req, res) => {
  res.render('board-form', { mode: 'create', post: { title: '', content: '', author: '' }, errors: {} });
});

// POST /board - create a new post
app.post('/board', async (req, res) => {
  try {
    const { errors, values } = validatePostInput(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).render('board-form', { mode: 'create', post: values, errors });
    }
    const id = await boardDataSource.createPost(values);
    return res.redirect(`/board/list/${id}`);
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).render('board-form', { mode: 'create', post: req.body || {}, errors: { _global: '서버 오류가 발생했습니다.' } });
  }
});

// GET /board/list/:id/edit - render edit form
app.get('/board/list/:id/edit', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).render('board-detail', { post: null });
    }
    const post = await boardDataSource.getPostById(id);
    if (!post) {
      return res.status(404).render('board-detail', { post: null });
    }
    res.render('board-form', { mode: 'edit', post, errors: {} });
  } catch (err) {
    console.error('Error rendering edit form:', err);
    res.status(500).render('board-detail', { post: null });
  }
});

// POST /board/list/:id/edit - submit edit
app.post('/board/list/:id/edit', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).render('board-detail', { post: null });
    }
    const existing = await boardDataSource.getPostById(id);
    if (!existing) {
      return res.status(404).render('board-detail', { post: null });
    }

    const { errors, values } = validatePostInput(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).render('board-form', { mode: 'edit', post: { ...existing, ...values }, errors });
    }

    await boardDataSource.updatePost(id, values);
    return res.redirect(`/board/list/${id}`);
  } catch (err) {
    console.error('Error updating post:', err);
    res.status(500).render('board-detail', { post: null });
  }
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Initialize DB then start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Express server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });



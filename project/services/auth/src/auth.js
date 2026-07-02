const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Mock database
const users = {
  admin: { password: 'admin123', role: 'admin' },
  user: { password: 'user123', role: 'user' }
};

// POST /login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`Auth request for user: ${username}`);

  if (users[username] && users[username].password === password) {
    const role = users[username].role;
    // Generate a simple mock token: "mock-jwt-<username>-<role>"
    const token = `mock-jwt-${username}-${role}`;
    return res.json({ token, role, username });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
});

// GET /userinfo
app.get('/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const parts = token.split('-');
  if (parts.length >= 4 && parts[0] === 'mock' && parts[1] === 'jwt') {
    const username = parts[2];
    const role = parts[3];
    return res.json({ username, role });
  }

  return res.status(401).json({ error: 'Invalid token' });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail } from '../db.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  const existing = await getUserByEmail(email);
  if (existing) return res.status(400).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await createUser({ username, email, password: hashed });
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, process.env.JWT_SECRET || 'dev-secret');
    res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const row = await getUserByEmail(email);
  if (!row) return res.status(400).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, row.password);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

  const user = { id: row.id, username: row.username, email: row.email };
  const token = jwt.sign(user, process.env.JWT_SECRET || 'dev-secret');
  res.json({ user, token });
});

export default router;

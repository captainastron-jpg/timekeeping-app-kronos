import express from 'express';
import jwt from 'jsonwebtoken';
import { getUserByAccessCode } from '../db.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { accessCode } = req.body;
  if (!accessCode) return res.status(400).json({ error: 'Missing access code' });

  const row = await getUserByAccessCode(accessCode);
  if (!row) return res.status(400).json({ error: 'Invalid access code' });

  const user = { id: row.id, name: row.username ?? row.name, accessCode: row.access_code ?? row.accessCode, role: row.role };
  const token = jwt.sign(user, process.env.JWT_SECRET || 'dev-secret');
  res.json({ user, token });
});

export default router;

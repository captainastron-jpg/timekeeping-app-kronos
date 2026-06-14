import express from 'express';
import { getAppUsers, createAppUser, updateAppUser, deleteAppUser } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const users = await getAppUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load users' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, accessCode, role } = req.body;
    if (!name || !accessCode || !role) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const user = await createAppUser({ name, access_code: accessCode, role });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, accessCode, role } = req.body;
    if (!name || !accessCode || !role) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const user = await updateAppUser(req.params.id, { name, access_code: accessCode, role });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await deleteAppUser(req.params.id);
    if (!ok) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

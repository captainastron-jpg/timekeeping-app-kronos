import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import timeRoutes from './routes/timeEntries.js';
import manageUsersRoutes from './routes/manageUsers.js';
import workScheduleRoutes from './routes/workSchedule.js';
import './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/time-entries', timeRoutes);
app.use('/api/manage/users', manageUsersRoutes);
app.use('/api/work-schedule', workScheduleRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

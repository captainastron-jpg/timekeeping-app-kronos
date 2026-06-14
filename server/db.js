import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'time_keeping_app';
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);

const pool = mysql.createPool({
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  port: MYSQL_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    port: MYSQL_PORT,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``);
  await conn.end();
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255) DEFAULT NULL,
      access_code VARCHAR(6) UNIQUE,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      project VARCHAR(255),
      description TEXT,
      start_time VARCHAR(255),
      end_time VARCHAR(255),
      duration_minutes INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value JSON NOT NULL
    )
  `);

  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS access_code VARCHAR(6) UNIQUE');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'");
  await pool.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) DEFAULT NULL');
  await pool.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL');
}

async function ensureDefaultUsers() {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
  if (rows[0].count === 0) {
    const defaultUsers = [
      { username: 'Super Admin', email: null, password: null, access_code: '000000', role: 'super_admin' },
      { username: 'Admin User', email: null, password: null, access_code: '111111', role: 'admin' },
      { username: 'John Doe', email: null, password: null, access_code: '123456', role: 'user' },
      { username: 'Jane Smith', email: null, password: null, access_code: '567890', role: 'user' },
      { username: 'Mike Johnson', email: null, password: null, access_code: '901234', role: 'user' },
    ];

    for (const user of defaultUsers) {
      await pool.query(
        'INSERT INTO users (username, email, password, access_code, role) VALUES (?, ?, ?, ?, ?)',
        [user.username, user.email, user.password, user.access_code, user.role]
      );
    }
  }
}

await ensureDatabase();
await ensureTables();
await ensureDefaultUsers();

export async function createUser({ username, email = null, password = null, access_code = null, role = 'user' }) {
  const [result] = await pool.query(
    'INSERT INTO users (username, email, password, access_code, role) VALUES (?, ?, ?, ?, ?)',
    [username, email, password, access_code, role]
  );

  return { id: result.insertId, username, email, access_code, role };
}

export async function getUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

export async function getUserById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function getAppUsers() {
  const [rows] = await pool.query('SELECT id, username AS name, access_code AS accessCode, role FROM users ORDER BY id');
  return rows;
}

export async function createAppUser({ name, access_code, role }) {
  const [result] = await pool.query(
    'INSERT INTO users (username, access_code, role) VALUES (?, ?, ?)',
    [name, access_code, role]
  );
  return { id: result.insertId, name, accessCode: access_code, role };
}

export async function updateAppUser(id, { name, access_code, role }) {
  const [result] = await pool.query(
    'UPDATE users SET username = ?, access_code = ?, role = ? WHERE id = ?',
    [name, access_code, role, Number(id)]
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query('SELECT id, username AS name, access_code AS accessCode, role FROM users WHERE id = ? LIMIT 1', [Number(id)]);
  return rows[0] || null;
}

export async function deleteAppUser(id) {
  const [result] = await pool.query('DELETE FROM users WHERE id = ?', [Number(id)]);
  return result.affectedRows > 0;
}

export async function getWorkSchedule() {
  const [rows] = await pool.query('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', ['work_schedule']);
  if (!rows[0]) {
    return {
      workDays: [1, 2, 3, 4, 5],
      startTime: '08:00',
      endTime: '17:00',
      holidays: [],
      workingHolidays: [],
      holidayNames: {},
    };
  }

  return JSON.parse(rows[0].setting_value);
}

export async function saveWorkSchedule(schedule) {
  const value = JSON.stringify(schedule);
  await pool.query(
    'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    ['work_schedule', value]
  );
  return schedule;
}

export async function createTimeEntry({ user_id, project, description, start_time, end_time, duration_minutes }) {
  const [result] = await pool.query(
    'INSERT INTO time_entries (user_id, project, description, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)',
    [user_id, project, description, start_time, end_time, duration_minutes ?? null]
  );

  const [rows] = await pool.query('SELECT * FROM time_entries WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] || null;
}

export async function getTimeEntriesByUser(user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM time_entries WHERE user_id = ? ORDER BY created_at DESC',
    [user_id]
  );
  return rows;
}

export async function getTimeEntryById(id, user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM time_entries WHERE id = ? AND user_id = ? LIMIT 1',
    [Number(id), user_id]
  );
  return rows[0] || null;
}

export async function updateTimeEntry(id, user_id, fields) {
  const { project, description, start_time, end_time, duration_minutes } = fields;
  const [result] = await pool.query(
    'UPDATE time_entries SET project = ?, description = ?, start_time = ?, end_time = ?, duration_minutes = ? WHERE id = ? AND user_id = ?',
    [project, description, start_time, end_time, duration_minutes ?? null, Number(id), user_id]
  );

  if (result.affectedRows === 0) return null;

  const [rows] = await pool.query('SELECT * FROM time_entries WHERE id = ? AND user_id = ? LIMIT 1', [Number(id), user_id]);
  return rows[0] || null;
}

export async function deleteTimeEntry(id, user_id) {
  const [result] = await pool.query('DELETE FROM time_entries WHERE id = ? AND user_id = ?', [Number(id), user_id]);
  return result.affectedRows > 0;
}

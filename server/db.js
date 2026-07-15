import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'time_keeping_app';
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);

const poolConfig = {
  host: MYSQL_HOST,
  user: MYSQL_USER,
  port: MYSQL_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

if (MYSQL_PASSWORD !== undefined && MYSQL_PASSWORD !== '') {
  poolConfig.password = MYSQL_PASSWORD;
}

if (MYSQL_DATABASE) {
  poolConfig.database = MYSQL_DATABASE;
}

const pool = mysql.createPool(poolConfig);

async function ensureDatabase() {
  const connectionOptions = {
    host: MYSQL_HOST,
    user: MYSQL_USER,
    port: MYSQL_PORT,
  };

  if (MYSQL_PASSWORD !== undefined && MYSQL_PASSWORD !== '') {
    connectionOptions.password = MYSQL_PASSWORD;
  }

  const conn = await mysql.createConnection(connectionOptions);

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``);
  await conn.end();
}

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [MYSQL_DATABASE, table, column]
  );
  return rows[0].count > 0;
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
      event_type VARCHAR(20) NOT NULL,
      project VARCHAR(255),
      description TEXT,
      timestamp DATETIME NOT NULL,
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INT PRIMARY KEY AUTO_INCREMENT,
      holiday_date DATE NOT NULL UNIQUE,
      holiday_name VARCHAR(255) NOT NULL,
      is_working BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!(await columnExists('time_entries', 'event_type'))) {
    await pool.query("ALTER TABLE time_entries ADD COLUMN event_type VARCHAR(20) NOT NULL DEFAULT 'Time In'");
  }
  if (!(await columnExists('time_entries', 'timestamp'))) {
    await pool.query("ALTER TABLE time_entries ADD COLUMN timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  }
  if (!(await columnExists('users', 'access_code'))) {
    await pool.query('ALTER TABLE users ADD COLUMN access_code VARCHAR(6) UNIQUE');
  }
  if (!(await columnExists('users', 'role'))) {
    await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'");
  }
  if (await columnExists('users', 'password')) {
    await pool.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) DEFAULT NULL');
  }
  if (await columnExists('users', 'email')) {
    await pool.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL');
  }
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

export async function getUserByAccessCode(access_code) {
  const [rows] = await pool.query('SELECT id, username, access_code, role FROM users WHERE access_code = ? LIMIT 1', [access_code]);
  return rows[0] || null;
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
  const baseSchedule = rows[0]
    ? JSON.parse(rows[0].setting_value)
    : {
        workDays: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '17:00',
        holidays: [],
        workingHolidays: [],
        holidayNames: {},
      };

  const [holidayRows] = await pool.query(
    'SELECT holiday_date, holiday_name, is_working FROM holidays ORDER BY holiday_date'
  );

  if (holidayRows.length === 0) {
    return baseSchedule;
  }

  const holidays = holidayRows.map((row) => row.holiday_date.toISOString().slice(0, 10));
  const workingHolidays = holidayRows.filter((row) => row.is_working).map((row) => row.holiday_date.toISOString().slice(0, 10));
  const holidayNames = Object.fromEntries(holidayRows.map((row) => [row.holiday_date.toISOString().slice(0, 10), row.holiday_name]));

  return {
    workDays: baseSchedule.workDays || [1, 2, 3, 4, 5],
    startTime: baseSchedule.startTime || '08:00',
    endTime: baseSchedule.endTime || '17:00',
    holidays,
    workingHolidays,
    holidayNames,
  };
}

export async function saveWorkSchedule(schedule) {
  const value = JSON.stringify(schedule);
  await pool.query(
    'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    ['work_schedule', value]
  );
  return schedule;
}

export async function addHoliday({ holiday_date, holiday_name, is_working }) {
  const [result] = await pool.query(
    'INSERT INTO holidays (holiday_date, holiday_name, is_working) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name), is_working = VALUES(is_working)',
    [holiday_date, holiday_name, is_working ? 1 : 0]
  );

  const [rows] = await pool.query('SELECT holiday_date, holiday_name, is_working FROM holidays WHERE holiday_date = ? LIMIT 1', [holiday_date]);
  return rows[0] || null;
}

export async function deleteHoliday(holiday_date) {
  const [result] = await pool.query('DELETE FROM holidays WHERE holiday_date = ?', [holiday_date]);
  return result.affectedRows > 0;
}

export async function createTimeEntry({ user_id, event_type, project, description, timestamp, duration_minutes }) {
  const [result] = await pool.query(
    'INSERT INTO time_entries (user_id, event_type, project, description, timestamp, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)',
    [user_id, event_type, project, description, timestamp, duration_minutes ?? null]
  );

  const [rows] = await pool.query(
    'SELECT t.*, u.username AS userName FROM time_entries t JOIN users u ON t.user_id = u.id WHERE t.id = ? LIMIT 1',
    [result.insertId]
  );
  return rows[0] || null;
}

export async function getTimeEntriesByUser(user_id) {
  const [rows] = await pool.query(
    'SELECT t.*, u.username AS userName FROM time_entries t JOIN users u ON t.user_id = u.id WHERE t.user_id = ? ORDER BY t.timestamp DESC',
    [user_id]
  );
  return rows;
}

export async function getAllTimeEntries() {
  const [rows] = await pool.query(
    'SELECT t.*, u.username AS userName FROM time_entries t JOIN users u ON t.user_id = u.id ORDER BY t.timestamp DESC'
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

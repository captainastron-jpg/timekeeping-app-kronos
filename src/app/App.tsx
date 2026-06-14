import { useEffect, useState } from 'react';
import { Clock, Coffee, RotateCcw, LogOut as LogOutIcon, FileText, UserPlus, User, Lock, Edit2, Trash2, Users, Calendar, Settings } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE = 'http://localhost:4000/api';

type LogEntry = {
  id: string;
  userId: string;
  userName: string;
  type: 'Time In' | 'Break' | 'Return' | 'Time Out';
  timestamp: Date;
};

type UserType = {
  id: string;
  name: string;
  accessCode: string;
  role: 'super_admin' | 'admin' | 'user';
};

type UserState = 'logged_out' | 'logged_in' | 'on_break';

type WorkSchedule = {
  workDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  holidays: string[]; // YYYY-MM-DD format
  workingHolidays: string[]; // holidays where work is allowed — all hours count as overtime
  holidayNames: Record<string, string>;
};

export default function App() {
  const [users, setUsers] = useState<UserType[]>([
    { id: '1', name: 'Super Admin', accessCode: '000000', role: 'super_admin' },
    { id: '2', name: 'Admin User', accessCode: '111111', role: 'admin' },
    { id: '3', name: 'John Doe', accessCode: '123456', role: 'user' },
    { id: '4', name: 'Jane Smith', accessCode: '567890', role: 'user' },
    { id: '5', name: 'Mike Johnson', accessCode: '901234', role: 'user' },
  ]);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showManageUsers, setShowManageUsers] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [userStates, setUserStates] = useState<Record<string, UserState>>({});
  const [showWorkSchedule, setShowWorkSchedule] = useState(false);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>({
    workDays: [1, 2, 3, 4, 5], // Monday to Friday
    startTime: '08:00',
    endTime: '17:00',
    holidays: [],
    workingHolidays: [],
    holidayNames: {},
  });
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayIsWorking, setNewHolidayIsWorking] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const usersRes = await fetch(`${API_BASE}/manage/users`);
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      }

      try {
        const scheduleRes = await fetch(`${API_BASE}/work-schedule`);
        if (scheduleRes.ok) {
          const scheduleData = await scheduleRes.json();
          setWorkSchedule({
            workDays: scheduleData.workDays || [1, 2, 3, 4, 5],
            startTime: scheduleData.startTime || '08:00',
            endTime: scheduleData.endTime || '17:00',
            holidays: scheduleData.holidays || [],
            workingHolidays: scheduleData.workingHolidays || [],
            holidayNames: scheduleData.holidayNames || {},
          });
        }
      } catch (err) {
        console.error('Failed to load schedule:', err);
      }
    };

    loadData();
  }, []);

  const saveWorkScheduleToDb = async (updatedSchedule: WorkSchedule) => {
    try {
      const res = await fetch(`${API_BASE}/work-schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSchedule),
      });
      if (res.ok) {
        const saved = await res.json();
        setWorkSchedule(saved);
      }
    } catch (err) {
      console.error('Unable to save work schedule:', err);
    }
  };

  const handleLogin = () => {
    const user = users.find(u => u.accessCode === accessCodeInput);
    if (user) {
      setCurrentUser(user);
      setAccessCodeInput('');
      setLoginError('');
    } else {
      setLoginError('Invalid access code. Please try again.');
      setAccessCodeInput('');
    }
  };

  const handleLogout = () => {
    // Don't reset user state - it persists across login sessions
    setCurrentUser(null);
    setAccessCodeInput('');
    setLoginError('');
    setShowManageUsers(false);
    setShowAddUser(false);
    setEditingUser(null);
    setShowWorkSchedule(false);
  };

  const toggleWorkDay = (day: number) => {
    const newWorkDays = workSchedule.workDays.includes(day)
      ? workSchedule.workDays.filter(d => d !== day)
      : [...workSchedule.workDays, day].sort();
    const updatedSchedule = { ...workSchedule, workDays: newWorkDays };
    setWorkSchedule(updatedSchedule);
    saveWorkScheduleToDb(updatedSchedule);
  };

  const addHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      alert('Please enter both date and holiday name.');
      return;
    }

    if (workSchedule.holidays.includes(newHolidayDate)) {
      alert('This date is already marked as a holiday.');
      return;
    }

    const updatedWorkingHolidays = newHolidayIsWorking
      ? [...workSchedule.workingHolidays, newHolidayDate].sort()
      : workSchedule.workingHolidays;

    const updatedSchedule: WorkSchedule = {
      ...workSchedule,
      holidays: [...workSchedule.holidays, newHolidayDate].sort(),
      workingHolidays: updatedWorkingHolidays,
      holidayNames: {
        ...workSchedule.holidayNames,
        [newHolidayDate]: newHolidayName.trim(),
      },
    };

    setWorkSchedule(updatedSchedule);
    setNewHolidayDate('');
    setNewHolidayName('');
    setNewHolidayIsWorking(false);
    saveWorkScheduleToDb(updatedSchedule);
  };

  const removeHoliday = (date: string) => {
    const updatedSchedule: WorkSchedule = {
      ...workSchedule,
      holidays: workSchedule.holidays.filter(h => h !== date),
      workingHolidays: workSchedule.workingHolidays.filter(h => h !== date),
      holidayNames: Object.fromEntries(
        Object.entries(workSchedule.holidayNames).filter(([key]) => key !== date)
      ),
    };
    setWorkSchedule(updatedSchedule);
    saveWorkScheduleToDb(updatedSchedule);
  };

  const isWorkingDay = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    const dateString = toLocalDateString(date);

    if (workSchedule.holidays.includes(dateString)) {
      return false;
    }

    return workSchedule.workDays.includes(dayOfWeek);
  };

  const getDayName = (dayNumber: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber];
  };

  const getCurrentUserState = (): UserState => {
    if (!currentUser) return 'logged_out';
    return userStates[currentUser.id] || 'logged_out';
  };

  const addLog = (type: LogEntry['type']) => {
    if (!currentUser) return;

    const newEntry: LogEntry = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      type,
      timestamp: new Date(),
    };
    setLogs([newEntry, ...logs]);

    // Update user state based on action
    const newState = { ...userStates };
    switch (type) {
      case 'Time In':
        newState[currentUser.id] = 'logged_in';
        break;
      case 'Break':
        newState[currentUser.id] = 'on_break';
        break;
      case 'Return':
        newState[currentUser.id] = 'logged_in';
        break;
      case 'Time Out':
        newState[currentUser.id] = 'logged_out';
        break;
    }
    setUserStates(newState);
  };

  const isButtonEnabled = (buttonType: LogEntry['type']): boolean => {
    const currentState = getCurrentUserState();
    const today = new Date();
    const todayString = toLocalDateString(today);
    const isHoliday = workSchedule.holidays.includes(todayString);
    const isWorkDay = isWorkingDay(today);

    const isWorkingHoliday = workSchedule.workingHolidays.includes(todayString);

    // Prevent Time In on regular holidays or non-work days (working holidays are allowed)
    if (buttonType === 'Time In' && !isWorkingHoliday && (isHoliday || !isWorkDay)) {
      return false;
    }

    switch (buttonType) {
      case 'Time In':
        return currentState === 'logged_out';
      case 'Break':
        return currentState === 'logged_in';
      case 'Return':
        return currentState === 'on_break';
      case 'Time Out':
        return currentState === 'logged_in';
      default:
        return false;
    }
  };

  const validateAccessCode = (code: string): boolean => {
    return /^\d{6}$/.test(code);
  };

  const addUser = async () => {
    if (!newUserName.trim() || !newAccessCode.trim()) {
      alert('Please enter both name and access code.');
      return;
    }

    if (!validateAccessCode(newAccessCode)) {
      alert('Access code must be exactly 6 numeric digits.');
      return;
    }

    const existingCode = users.find(u => u.accessCode === newAccessCode.trim());
    if (existingCode) {
      alert('This access code is already in use. Please choose a different code.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/manage/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName.trim(), accessCode: newAccessCode.trim(), role: newUserRole }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Unable to add user');
      }
      const newUser = await res.json();
      setUsers([...users, newUser]);
      setNewUserName('');
      setNewAccessCode('');
      setNewUserRole('user');
      setShowAddUser(false);
    } catch (err) {
      alert(String(err));
    }
  };

  const updateUser = async (userId: string, name: string, accessCode: string, role: 'admin' | 'user') => {
    if (!name.trim() || !accessCode.trim()) {
      alert('Please enter both name and access code.');
      return;
    }

    if (!validateAccessCode(accessCode)) {
      alert('Access code must be exactly 6 numeric digits.');
      return;
    }

    const existingCode = users.find(u => u.accessCode === accessCode && u.id !== userId);
    if (existingCode) {
      alert('This access code is already in use. Please choose a different code.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/manage/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), accessCode: accessCode.trim(), role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Unable to update user');
      }
      const updatedUser = await res.json();
      setUsers(users.map(u => (u.id === userId ? updatedUser : u)));
      setEditingUser(null);
    } catch (err) {
      alert(String(err));
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/manage/users/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Unable to delete user');
      }
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      alert(String(err));
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDateRange = (period: 'daily' | 'weekly' | 'monthly') => {
    const now = new Date();
    const start = new Date();

    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setMonth(now.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return { start, end: now };
  };

  const toLocalDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const parseScheduleTime = (dateContext: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(dateContext);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  type WorkDetails = {
    totalWorkHours: number;
    lateMinutes: number;
    overtimeMinutes: number;
  };

  const calculateWorkDetails = (userLogs: LogEntry[]): WorkDetails => {
    let totalMinutes = 0;
    let totalLateMinutes = 0;
    let totalOvertimeMinutes = 0;
    let currentTimeIn: Date | null = null;
    let currentBreakStart: Date | null = null;
    let breakMinutes = 0;

    const sortedLogs = [...userLogs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    sortedLogs.forEach(log => {
      switch (log.type) {
        case 'Time In': {
          currentTimeIn = log.timestamp;
          breakMinutes = 0;
          const dateStr = toLocalDateString(log.timestamp);
          const isWorkingHol = workSchedule.workingHolidays.includes(dateStr);
          if (!isWorkingHol) {
            const schedStart = parseScheduleTime(log.timestamp, workSchedule.startTime);
            if (log.timestamp.getTime() > schedStart.getTime()) {
              totalLateMinutes += (log.timestamp.getTime() - schedStart.getTime()) / (1000 * 60);
            }
          }
          break;
        }
        case 'Break':
          currentBreakStart = log.timestamp;
          break;
        case 'Return':
          if (currentBreakStart) {
            breakMinutes += (log.timestamp.getTime() - currentBreakStart.getTime()) / (1000 * 60);
            currentBreakStart = null;
          }
          break;
        case 'Time Out':
          if (currentTimeIn) {
            const sessionMinutes = (log.timestamp.getTime() - currentTimeIn.getTime()) / (1000 * 60);
            const netMinutes = sessionMinutes - breakMinutes;
            totalMinutes += netMinutes;
            const dateStr = toLocalDateString(log.timestamp);
            const isWorkingHol = workSchedule.workingHolidays.includes(dateStr);
            if (isWorkingHol) {
              // All hours worked on a working holiday are overtime
              totalOvertimeMinutes += netMinutes;
            } else {
              const schedEnd = parseScheduleTime(log.timestamp, workSchedule.endTime);
              if (log.timestamp.getTime() > schedEnd.getTime()) {
                totalOvertimeMinutes += (log.timestamp.getTime() - schedEnd.getTime()) / (1000 * 60);
              }
            }
            currentTimeIn = null;
            breakMinutes = 0;
          }
          break;
      }
    });

    return {
      totalWorkHours: totalMinutes / 60,
      lateMinutes: totalLateMinutes,
      overtimeMinutes: totalOvertimeMinutes,
    };
  };

  const calculateWorkHours = (userLogs: LogEntry[]): number => {
    return calculateWorkDetails(userLogs).totalWorkHours;
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const generatePDFReport = (period: 'daily' | 'weekly' | 'monthly') => {
    const { start, end } = getDateRange(period);
    let filteredLogs = logs.filter(
      log => log.timestamp >= start && log.timestamp <= end
    );

    // If regular user, only show their own logs
    if (currentUser && currentUser.role === 'user') {
      filteredLogs = filteredLogs.filter(log => log.userId === currentUser.id);
    }

    if (filteredLogs.length === 0) {
      alert(`No logs found for the ${period} period.`);
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`Time Keeping Report - ${period.charAt(0).toUpperCase() + period.slice(1)}`, 14, 20);

    doc.setFontSize(11);
    doc.text(`Generated: ${formatDate(new Date())} ${formatTime(new Date())}`, 14, 28);
    doc.text(`Period: ${formatDate(start)} - ${formatDate(end)}`, 14, 34);
    doc.text(`Work Hours: ${workSchedule.startTime} - ${workSchedule.endTime}`, 14, 40);
    doc.text(`Work Days: ${workSchedule.workDays.map(d => getDayName(d).slice(0, 3)).join(', ')}`, 14, 46);

    const userGroups = filteredLogs.reduce((acc, log) => {
      if (!acc[log.userName]) {
        acc[log.userName] = [];
      }
      acc[log.userName].push(log);
      return acc;
    }, {} as Record<string, LogEntry[]>);

    let yPosition = 57;

    Object.entries(userGroups).forEach(([userName, userLogs]) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      const details = calculateWorkDetails(userLogs);

      doc.setFontSize(14);
      doc.text(`Employee: ${userName}`, 14, yPosition);
      yPosition += 7;

      doc.setFontSize(11);
      doc.setTextColor(0, 100, 0);
      doc.text(`Total Work Hours: ${formatHours(details.totalWorkHours)}`, 14, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 6;

      if (details.lateMinutes > 0) {
        doc.setTextColor(180, 80, 0);
        const lateH = Math.floor(details.lateMinutes / 60);
        const lateM = Math.round(details.lateMinutes % 60);
        const lateStr = lateH > 0 ? `${lateH}h ${lateM}m` : `${lateM}m`;
        doc.text(`Late Arrival: ${lateStr} late`, 14, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 6;
      }

      if (details.overtimeMinutes > 0) {
        doc.setTextColor(0, 0, 180);
        doc.text(`Overtime: ${formatHours(details.overtimeMinutes / 60)}`, 14, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 6;
      }

      yPosition += 4;

      const tableData = userLogs.map(log => {
        const dateStr = toLocalDateString(log.timestamp);
        const isWorkingHol = workSchedule.workingHolidays.includes(dateStr);
        const note = isWorkingHol ? 'Working Holiday (OT)' : '';
        return [formatDate(log.timestamp), formatTime(log.timestamp), log.type, note];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['Date', 'Time', 'Event', 'Note']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    });

    doc.save(`timekeeping-report-${period}-${formatDate(new Date()).replace(/\s/g, '-')}.pdf`);
  };

  const getButtonColor = (type: string) => {
    switch (type) {
      case 'Time In':
        return 'bg-green-500 hover:bg-green-600';
      case 'Break':
        return 'bg-amber-500 hover:bg-amber-600';
      case 'Return':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'Time Out':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'Time In':
        return <Clock className="w-5 h-5" />;
      case 'Break':
        return <Coffee className="w-5 h-5" />;
      case 'Return':
        return <RotateCcw className="w-5 h-5" />;
      case 'Time Out':
        return <LogOutIcon className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'user':
        return 'User';
      default:
        return role;
    }
  };

  // Login Screen
  if (!currentUser) {
    return (
      <div className="size-full bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-500 p-4 rounded-full">
              <Lock className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="mb-2 text-center text-gray-800">Time Keeping System</h1>
          <p className="text-center text-gray-600 mb-8">Enter your 6-digit access code to continue</p>

          {loginError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-center">
              {loginError}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Access Code</label>
            <input
              type="password"
              value={accessCodeInput}
              onChange={(e) => setAccessCodeInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Enter your 6-digit code"
              maxLength={6}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors"
          >
            Login
          </button>

        </div>
      </div>
    );
  }

  // Main Panel (logged in)
  return (
    <div className="size-full bg-gray-50 p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-gray-800">Time Keeping System</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-700">
                <User className="w-5 h-5" />
                <span>{currentUser.name}</span>
                <span className={`px-2 py-1 rounded text-xs ${getRoleBadgeColor(currentUser.role)}`}>
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
              >
                <LogOutIcon className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          {currentUser.role === 'super_admin' && (
            <div className="mb-6 flex items-center gap-4 flex-wrap">
              <button
                onClick={() => {
                  setShowManageUsers(!showManageUsers);
                  setShowAddUser(false);
                  setShowWorkSchedule(false);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Users className="w-5 h-5" />
                Manage Users
              </button>
              <button
                onClick={() => {
                  setShowAddUser(!showAddUser);
                  setShowManageUsers(false);
                  setShowWorkSchedule(false);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                Add User
              </button>
              <button
                onClick={() => {
                  setShowWorkSchedule(!showWorkSchedule);
                  setShowManageUsers(false);
                  setShowAddUser(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Settings className="w-5 h-5" />
                Work Schedule
              </button>
            </div>
          )}

          {showAddUser && currentUser.role === 'super_admin' && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-gray-700 mb-4">Add New User</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter user name"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newAccessCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setNewAccessCode(value.slice(0, 6));
                  }}
                  placeholder="Enter 6-digit access code"
                  maxLength={6}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user')}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={addUser}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Add User
                  </button>
                  <button
                    onClick={() => {
                      setShowAddUser(false);
                      setNewUserName('');
                      setNewAccessCode('');
                      setNewUserRole('user');
                    }}
                    className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {showManageUsers && currentUser.role === 'super_admin' && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-gray-700 mb-4">Manage Users</h3>
              <div className="space-y-3">
                {users.filter(u => u.role !== 'super_admin').map(user => (
                  <div key={user.id} className="bg-white p-4 rounded-lg border border-gray-200">
                    {editingUser?.id === user.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          defaultValue={user.name}
                          onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          defaultValue={user.accessCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            setEditingUser({ ...editingUser, accessCode: value.slice(0, 6) });
                          }}
                          maxLength={6}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={editingUser.role}
                          onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'admin' | 'user' })}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateUser(user.id, editingUser.name, editingUser.accessCode, editingUser.role as 'admin' | 'user')}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-gray-800">{user.name}</p>
                            <span className={`px-2 py-1 rounded text-xs ${getRoleBadgeColor(user.role)}`}>
                              {getRoleLabel(user.role)}
                            </span>
                          </div>
                          <p className="text-gray-500 text-sm">Access Code: {user.accessCode}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showWorkSchedule && currentUser.role === 'super_admin' && (
            <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-gray-700 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Work Schedule Configuration
                </h3>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-300 text-sm">
                  <span className="text-gray-600">Holidays Configured: </span>
                  <span className="font-semibold text-gray-800">{workSchedule.holidays.length}</span>
                </div>
              </div>

              {/* Work Days Selection */}
              <div className="mb-6">
                <h4 className="text-gray-700 mb-3">Work Days</h4>
                <div className="grid grid-cols-7 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map(day => (
                    <button
                      key={day}
                      onClick={() => toggleWorkDay(day)}
                      className={`p-3 rounded-lg text-sm transition-colors ${
                        workSchedule.workDays.includes(day)
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {getDayName(day).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Work Hours */}
              <div className="mb-6">
                <h4 className="text-gray-700 mb-3">Work Hours</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={workSchedule.startTime}
                      onChange={(e) => {
                        const updatedSchedule = { ...workSchedule, startTime: e.target.value };
                        setWorkSchedule(updatedSchedule);
                        saveWorkScheduleToDb(updatedSchedule);
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">End Time</label>
                    <input
                      type="time"
                      value={workSchedule.endTime}
                      onChange={(e) => {
                        const updatedSchedule = { ...workSchedule, endTime: e.target.value };
                        setWorkSchedule(updatedSchedule);
                        saveWorkScheduleToDb(updatedSchedule);
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Current: {workSchedule.startTime} - {workSchedule.endTime}
                </p>
              </div>

              {/* Holidays */}
              <div>
                <h4 className="text-gray-700 mb-3">Holidays</h4>
                <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Holiday Name</label>
                      <input
                        type="text"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addHoliday()}
                        placeholder="e.g., Christmas Day"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        onClick={() => setNewHolidayIsWorking(!newHolidayIsWorking)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${newHolidayIsWorking ? 'bg-blue-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${newHolidayIsWorking ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                      <div>
                        <span className="text-sm text-gray-700">Working Holiday</span>
                        <p className="text-xs text-gray-500">
                          {newHolidayIsWorking
                            ? 'Time In allowed — all hours worked count as overtime'
                            : 'Regular holiday — Time In is disabled'}
                        </p>
                      </div>
                    </label>
                  </div>
                  <button
                    onClick={addHoliday}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  >
                    Add Holiday
                  </button>
                </div>

                {workSchedule.holidays.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 text-sm">No holidays added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {workSchedule.holidays.sort().map(holiday => {
                      const isWorking = workSchedule.workingHolidays.includes(holiday);
                      return (
                        <div key={holiday} className={`flex items-center justify-between p-3 bg-white rounded-lg border ${isWorking ? 'border-blue-200' : 'border-gray-200'}`}>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-gray-800">{workSchedule.holidayNames[holiday] || 'Holiday'}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${isWorking ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                {isWorking ? '💼 Working Holiday' : '🎉 Regular Holiday'}
                              </span>
                            </div>
                            <p className="text-gray-500 text-sm">
                              {new Date(holiday + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                          <button
                            onClick={() => removeHoliday(holiday)}
                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(() => {
              const today = new Date();
              const todayString = toLocalDateString(today);
              const isHoliday = workSchedule.holidays.includes(todayString);
              const isWorkingHoliday = workSchedule.workingHolidays.includes(todayString);
              const isWorkDay = isWorkingDay(today);

              if (isHoliday && isWorkingHoliday) {
                return (
                  <>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>💼 Working Holiday:</strong> {workSchedule.holidayNames[todayString] || 'Holiday'} — All hours worked count as overtime
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Current Status:</strong>{' '}
                        {getCurrentUserState() === 'logged_out' && 'Not Logged In - Click "Time In" to start'}
                        {getCurrentUserState() === 'logged_in' && 'Logged In - You can take a "Break" or "Time Out"'}
                        {getCurrentUserState() === 'on_break' && 'On Break - Click "Return" to resume work'}
                      </p>
                    </div>
                  </>
                );
              }

              if (isHoliday) {
                return (
                  <>
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>🎉 Holiday:</strong> {workSchedule.holidayNames[todayString] || 'Holiday'} — Time In is disabled
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Current Status:</strong>{' '}
                        {getCurrentUserState() === 'logged_out' && 'Not Logged In'}
                        {getCurrentUserState() === 'logged_in' && 'Logged In - You can take a "Break" or "Time Out"'}
                        {getCurrentUserState() === 'on_break' && 'On Break - Click "Return" to resume work'}
                      </p>
                    </div>
                  </>
                );
              }

              if (!isWorkDay) {
                return (
                  <>
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Weekend:</strong> Time In is disabled on non-work days
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Current Status:</strong>{' '}
                        {getCurrentUserState() === 'logged_out' && 'Not Logged In'}
                        {getCurrentUserState() === 'logged_in' && 'Logged In - You can take a "Break" or "Time Out"'}
                        {getCurrentUserState() === 'on_break' && 'On Break - Click "Return" to resume work'}
                      </p>
                    </div>
                  </>
                );
              }

              return (
                <>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Current Status:</strong>{' '}
                      {getCurrentUserState() === 'logged_out' && 'Not Logged In - Click "Time In" to start'}
                      {getCurrentUserState() === 'logged_in' && 'Logged In - You can take a "Break" or "Time Out"'}
                      {getCurrentUserState() === 'on_break' && 'On Break - Click "Return" to resume work'}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Work Day:</strong> Scheduled hours: {workSchedule.startTime} - {workSchedule.endTime}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <button
              onClick={() => isButtonEnabled('Time In') && addLog('Time In')}
              disabled={!isButtonEnabled('Time In')}
              className={`${
                isButtonEnabled('Time In')
                  ? getButtonColor('Time In')
                  : 'bg-gray-300 cursor-not-allowed'
              } text-white py-4 px-6 rounded-lg flex flex-col items-center gap-2 transition-colors`}
            >
              <Clock className="w-8 h-8" />
              <span>Time In</span>
            </button>

            <button
              onClick={() => isButtonEnabled('Break') && addLog('Break')}
              disabled={!isButtonEnabled('Break')}
              className={`${
                isButtonEnabled('Break')
                  ? getButtonColor('Break')
                  : 'bg-gray-300 cursor-not-allowed'
              } text-white py-4 px-6 rounded-lg flex flex-col items-center gap-2 transition-colors`}
            >
              <Coffee className="w-8 h-8" />
              <span>Break</span>
            </button>

            <button
              onClick={() => isButtonEnabled('Return') && addLog('Return')}
              disabled={!isButtonEnabled('Return')}
              className={`${
                isButtonEnabled('Return')
                  ? getButtonColor('Return')
                  : 'bg-gray-300 cursor-not-allowed'
              } text-white py-4 px-6 rounded-lg flex flex-col items-center gap-2 transition-colors`}
            >
              <RotateCcw className="w-8 h-8" />
              <span>Return</span>
            </button>

            <button
              onClick={() => isButtonEnabled('Time Out') && addLog('Time Out')}
              disabled={!isButtonEnabled('Time Out')}
              className={`${
                isButtonEnabled('Time Out')
                  ? getButtonColor('Time Out')
                  : 'bg-gray-300 cursor-not-allowed'
              } text-white py-4 px-6 rounded-lg flex flex-col items-center gap-2 transition-colors`}
            >
              <LogOutIcon className="w-8 h-8" />
              <span>Time Out</span>
            </button>
          </div>

          <div className="border-t pt-6 mb-6">
            <h2 className="mb-4 text-gray-700">
              {currentUser.role === 'user' ? 'Generate My Reports' : 'Generate Reports'}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => generatePDFReport('daily')}
                className="bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <FileText className="w-5 h-5" />
                <span>Daily</span>
              </button>
              <button
                onClick={() => generatePDFReport('weekly')}
                className="bg-indigo-500 hover:bg-indigo-600 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <FileText className="w-5 h-5" />
                <span>Weekly</span>
              </button>
              <button
                onClick={() => generatePDFReport('monthly')}
                className="bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <FileText className="w-5 h-5" />
                <span>Monthly</span>
              </button>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-700">
                {currentUser.role === 'super_admin' || currentUser.role === 'admin' ? 'All Activity Logs' : 'My Activity Log'}
              </h2>
              {currentUser.role === 'user' && (() => {
                const todayStr = toLocalDateString(new Date());
                const todayLogs = logs.filter(log =>
                  log.userId === currentUser.id &&
                  toLocalDateString(log.timestamp) === todayStr
                );
                if (todayLogs.length === 0) return null;
                const details = calculateWorkDetails(todayLogs);
                return (
                  <div className="flex flex-wrap gap-2">
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                      <span className="text-sm">Total Hours Today: </span>
                      <span className="font-semibold">{formatHours(details.totalWorkHours)}</span>
                    </div>
                    {details.lateMinutes > 0 && (
                      <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg">
                        <span className="text-sm">Late: </span>
                        <span className="font-semibold">
                          {(() => {
                            const lh = Math.floor(details.lateMinutes / 60);
                            const lm = Math.round(details.lateMinutes % 60);
                            return lh > 0 ? `${lh}h ${lm}m` : `${lm}m`;
                          })()}
                        </span>
                      </div>
                    )}
                    {details.overtimeMinutes > 0 && (
                      <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg">
                        <span className="text-sm">Overtime: </span>
                        <span className="font-semibold">{formatHours(details.overtimeMinutes / 60)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {(() => {
              const filteredLogs = (currentUser.role === 'super_admin' || currentUser.role === 'admin')
                ? logs
                : logs.filter(log => log.userId === currentUser.id);

              return filteredLogs.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No entries yet. Click a button to log an event.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className={`${getButtonColor(log.type).split(' ')[0]} p-2 rounded-full text-white`}>
                        {getLogIcon(log.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-800">{log.type}</p>
                        {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
                          <p className="text-gray-500 text-sm">{log.userName}</p>
                        )}
                        <p className="text-gray-500 text-sm">{formatDate(log.timestamp)}</p>
                      </div>
                      <div className="text-gray-600">
                        {formatTime(log.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

const Attendance = require('../models/Attendance');
const User = require('../models/User');

const formatDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

const checkIn = async (req, res) => {
  try {
    const user = req.user;
    const today = formatDate();
    let att = await Attendance.findOne({ userId: user._id, date: today });
    if (att && att.checkInTime) {
      return res.status(400).json({ message: 'Already checked in' });
    }
    const now = new Date();

    const nineThirty = new Date();
    nineThirty.setHours(9,30,0,0);
    let status = 'present';
    if (now > nineThirty) status = 'late';

    if (!att) {
      att = new Attendance({
        userId: user._id,
        date: today,
        checkInTime: now,
        status
      });
    } else {
      att.checkInTime = now;
      att.status = status;
    }
    await att.save();
    res.json(att);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const checkOut = async (req, res) => {
  try {
    const user = req.user;
    const today = formatDate();
    const att = await Attendance.findOne({ userId: user._id, date: today });
    if (!att || !att.checkInTime) {
      return res.status(400).json({ message: 'No check-in record for today' });
    }
    if (att.checkOutTime) {
      return res.status(400).json({ message: 'Already checked out' });
    }
    const now = new Date();
    att.checkOutTime = now;
    const diffMs = now - att.checkInTime;
    att.totalHours = Math.round((diffMs / (1000*60*60)) * 100) / 100;
    if (att.totalHours < 4) att.status = 'half-day';
    await att.save();
    res.json(att);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const myHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { from, to } = req.query; 
    const q = { userId };
    if (from && to) q.date = { $gte: from, $lte: to };
    const records = await Attendance.find(q).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const mySummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month } = req.query; 
    const now = new Date();
    const m = month || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const start = `${m}-01`;
    const end = `${m}-${String(31).padStart(2,'0')}`; 
    const records = await Attendance.find({ userId, date: { $regex: `^${m}` } });
    const present = records.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'half-day').length;
    const late = records.filter(r => r.status === 'late').length;
    res.json({ month: m, present, late, totalRecords: records.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const todayStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = formatDate();
    const att = await Attendance.findOne({ userId, date: today });
    res.json(att || { date: today });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const allAttendance = async (req, res) => {
  try {
    const { employeeId, from, to, status } = req.query;
    const q = {};
    if (employeeId) {
      const user = await User.findOne({ employeeId });
      if (!user) return res.status(404).json({ message: 'Employee not found' });
      q.userId = user._id;
    }
    if (from && to) q.date = { $gte: from, $lte: to };
    if (status) q.status = status;
    const records = await Attendance.find(q).populate('userId', 'name email employeeId department');
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const employeeAttendance = async (req, res) => {
  try {
    const id = req.params.id; 
    const records = await Attendance.find({ userId: id }).sort({ date: -1 });
    res.json(records);
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const exportCSV = async (req, res) => {
  try {
    const { from, to } = req.query;
    const q = {};
    if (from && to) q.date = { $gte: from, $lte: to };
    const recs = await Attendance.find(q).populate('userId', 'name employeeId email department').sort({ date: 1 });
   
    const header = ['employeeId','name','email','department','date','checkInTime','checkOutTime','status','totalHours'];
    const rows = recs.map(r => [
      r.userId.employeeId || '',
      r.userId.name || '',
      r.userId.email || '',
      r.userId.department || '',
      r.date,
      r.checkInTime ? r.checkInTime.toISOString() : '',
      r.checkOutTime ? r.checkOutTime.toISOString() : '',
      r.status || '',
      r.totalHours || ''
    ]);
    const csv = [header.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${Date.now()}.csv"`);
    res.send(csv);
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}
const weeklyAttendance = async (req, res) => {
  try {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      
      const present = await Attendance.countDocuments({ 
        date: dateStr, 
        status: { $in: ['present', 'late', 'half-day'] } 
      });
      const absent = await Attendance.countDocuments({ 
        date: dateStr, 
        status: 'absent' 
      });
      const late = await Attendance.countDocuments({ 
        date: dateStr, 
        status: 'late' 
      });
      const halfDay = await Attendance.countDocuments({ 
        date: dateStr, 
        status: 'half-day' 
      });
      
      days.push({
        date: dateStr,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        present,
        absent,
        late,
        halfDay,
        totalEmployees: await User.countDocuments({ role: 'employee' })
      });
    }
    
    res.json(days);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const calendarData = async (req, res) => {
  try {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    
    const records = await Attendance.find({
      date: { $regex: `^${currentMonth}` }
    }).populate('userId', 'name department');
    
    const dateMap = {};
    records.forEach(record => {
      if (!dateMap[record.date]) {
        dateMap[record.date] = {
          date: record.date,
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          employees: []
        };
      }
      
      dateMap[record.date][record.status]++;
      dateMap[record.date].employees.push({
        name: record.userId.name,
        department: record.userId.department,
        status: record.status,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime
      });
    });
    
    const result = Object.values(dateMap).map(day => {
      const statusCounts = [
        { status: 'present', count: day.present },
        { status: 'absent', count: day.absent },
        { status: 'late', count: day.late },
        { status: 'half-day', count: day.halfDay }
      ];
      
      const dominantStatus = statusCounts.reduce((prev, current) => 
        (prev.count > current.count) ? prev : current
      ).status;
      
      return {
        ...day,
        dominantStatus,
        totalEmployees: day.present + day.absent + day.late + day.halfDay
      };
    });
    
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const departmentSummary = async (req, res) => {
  try {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    
    const users = await User.find({ role: 'employee' });
    const departments = [...new Set(users.map(u => u.department).filter(Boolean))];
    
    const result = [];
    
    for (const dept of departments) {
      const deptUsers = users.filter(u => u.department === dept);
      const userIds = deptUsers.map(u => u._id);
      
      const attendanceRecords = await Attendance.find({
        userId: { $in: userIds },
        date: { $regex: `^${currentMonth}` }
      });
      
      const present = attendanceRecords.filter(r => 
        ['present', 'late', 'half-day'].includes(r.status)
      ).length;
      
      result.push({
        department: dept,
        total: deptUsers.length,
        present,
        absent: deptUsers.length - present,
        attendanceRate: Math.round((present / deptUsers.length) * 100)
      });
    }
    
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const todayDetailedStatus = async (req, res) => {
  try {
    const today = formatDate();
    
    const totalEmployees = await User.countDocuments({ role: 'employee' });
    
    const todayAttendance = await Attendance.find({ date: today })
      .populate('userId', 'name employeeId department');
    
    const presentCount = todayAttendance.filter(a => 
      ['present', 'late', 'half-day'].includes(a.status)
    ).length;
    
    const absentCount = totalEmployees - presentCount;
    const lateCount = todayAttendance.filter(a => a.status === 'late').length;
    const halfDayCount = todayAttendance.filter(a => a.status === 'half-day').length;
    
    const presentUserIds = todayAttendance.map(a => a.userId._id);
    const absentEmployees = await User.find({
      role: 'employee',
      _id: { $nin: presentUserIds }
    }).select('name employeeId department');
    
    const lateEmployees = todayAttendance
      .filter(a => a.status === 'late')
      .map(a => ({
        name: a.userId.name,
        employeeId: a.userId.employeeId,
        department: a.userId.department,
        checkInTime: a.checkInTime
      }));
    
    res.json({
      presentCount,
      absentCount,
      lateCount,
      halfDayCount,
      totalEmployees,
      absentEmployees,
      lateEmployees
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const teamSummary = async (req, res) => {
  try {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    
    const records = await Attendance.find({
      date: { $regex: `^${currentMonth}` }
    });
    
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const halfDay = records.filter(r => r.status === 'half-day').length;
    
    res.json({
      present,
      absent,
      late,
      halfDay,
      totalRecords: records.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  checkIn, checkOut, myHistory, mySummary, todayStatus,
  allAttendance, employeeAttendance, teamSummary,
  exportCSV, todayDetailedStatus,
  weeklyAttendance, calendarData, departmentSummary
};
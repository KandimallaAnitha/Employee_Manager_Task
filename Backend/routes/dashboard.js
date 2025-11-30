const express = require('express');
const router = express.Router(); 
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

router.get('/employee', auth, async (req, res) => {
  try {
    const user = req.user;
    const today = (new Date()).toISOString().slice(0,10);
    const att = await Attendance.findOne({ userId: user._id, date: today });
    const month = (new Date()).toISOString().slice(0,7);
    const records = await Attendance.find({ userId: user._id, date: { $regex: `^${month}` }});
    
    const present = records.filter(r => ['present', 'late', 'half-day'].includes(r.status)).length;
    const late = records.filter(r => r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const totalHours = records.reduce((s,r) => s + (r.totalHours || 0), 0);
    const recent = await Attendance.find({ userId: user._id }).sort({ date: -1 }).limit(7);
    
    res.json({
      todayStatus: att ? att.status : 'absent',
      month: month,
      present,
      late,
      absent,
      totalHours: Math.round(totalHours*100)/100,
      recent
    });
  } catch (err) {
    console.error(err); 
    res.status(500).json({message: 'Server error'})
  }
});

router.get('/manager', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    
    const usersCount = await User.countDocuments({ role: 'employee' });
    const today = (new Date()).toISOString().slice(0,10);
    
    const presentToday = await Attendance.countDocuments({ 
      date: today, 
      status: { $in: ['present', 'late', 'half-day'] } 
    });
    const lateToday = await Attendance.countDocuments({ date: today, status: 'late' });
    const absentToday = usersCount - presentToday;
    const halfDayToday = await Attendance.countDocuments({ date: today, status: 'half-day' });
    
    // Weekly data
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); 
      d.setDate(d.getDate()-i);
      const dateStr = d.toISOString().slice(0,10);
      
      const present = await Attendance.countDocuments({ 
        date: dateStr, 
        status: { $in: ['present', 'late', 'half-day'] } 
      });
      const absent = await Attendance.countDocuments({ date: dateStr, status: 'absent' });
      const late = await Attendance.countDocuments({ date: dateStr, status: 'late' });
      const halfDay = await Attendance.countDocuments({ date: dateStr, status: 'half-day' });
      
      days.push({ 
        date: dateStr, 
        present, 
        absent, 
        late, 
        halfDay,
        totalEmployees: usersCount
      });
    }
    
    res.json({ 
      totalEmployees: usersCount, 
      presentToday, 
      absentToday,
      lateToday, 
      halfDayToday,
      weekly: days 
    });
  } catch(err) { 
    console.error(err); 
    res.status(500).json({ message: 'Server error' }) 
  }
});

module.exports = router;
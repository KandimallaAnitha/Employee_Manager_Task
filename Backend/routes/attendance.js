const express = require('express');
const router = express.Router(); 
const auth = require('../middleware/auth');
const permit = require('../middleware/role');
const ctrl = require('../controllers/attendanceController');

router.post('/checkin', auth, ctrl.checkIn);
router.post('/checkout', auth, ctrl.checkOut);
router.get('/my-history', auth, ctrl.myHistory);
router.get('/my-summary', auth, ctrl.mySummary);
router.get('/today', auth, ctrl.todayStatus);


router.get('/all', auth, permit('manager'), ctrl.allAttendance);
router.get('/employee/:id', auth, permit('manager'), ctrl.employeeAttendance);
router.get('/summary', auth, permit('manager'), ctrl.teamSummary);
router.get('/export', auth, permit('manager'), ctrl.exportCSV);
router.get('/today-status', auth, permit('manager'), ctrl.todayDetailedStatus);
router.get('/weekly', auth, permit('manager'), ctrl.weeklyAttendance);
router.get('/calendar', auth, permit('manager'), ctrl.calendarData);
router.get('/departments', auth, permit('manager'), ctrl.departmentSummary);

module.exports = router;
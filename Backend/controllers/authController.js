// controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  try {
    const { name, email, password, role, employeeId, department, companyName, position, managerCode } = req.body;
    
    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'Email already used' });

   

    // Auto-generate employee ID if not provided for employees
    let finalEmployeeId = employeeId;
    if (role === 'employee' && !employeeId) {
      const empCount = await User.countDocuments({ role: 'employee' });
      finalEmployeeId = `EMP${String(empCount + 1).padStart(3, '0')}`;
      
      // Check if generated ID already exists
      const existingWithId = await User.findOne({ employeeId: finalEmployeeId });
      if (existingWithId) {
        finalEmployeeId = `EMP${String(empCount + 2).padStart(3, '0')}`;
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Create user object based on role
    const userData = {
      name,
      email,
      password: hashed,
      role: role || 'employee',
      employeeId: finalEmployeeId,
      department
    };

    // Add manager-specific fields
    if (role === 'manager') {
      userData.companyName = companyName;
      userData.position = position;
      // Clear employee-specific fields for managers
      userData.employeeId = undefined;
      userData.department = undefined;
    }

    user = new User(userData);
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    // Return user data based on role
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // Add role-specific fields to response
    if (user.role === 'employee') {
      userResponse.employeeId = user.employeeId;
      userResponse.department = user.department;
    } else if (user.role === 'manager') {
      userResponse.companyName = user.companyName;
      userResponse.position = user.position;
    }

    res.status(201).json({
      user: userResponse,
      token
    });

  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email or Employee ID already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ message: 'Missing credentials' });

    const user = await User.findOne({ email });
    if(!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if(!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // Add role-specific fields to response
    if (user.role === 'employee') {
      userResponse.employeeId = user.employeeId;
      userResponse.department = user.department;
    } else if (user.role === 'manager') {
      userResponse.companyName = user.companyName;
      userResponse.position = user.position;
    }

    res.json({
      user: userResponse,
      token
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const me = async (req, res) => {
  // Return complete user data based on role
  const userResponse = {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  };

  // Add role-specific fields to response
  if (req.user.role === 'employee') {
    userResponse.employeeId = req.user.employeeId;
    userResponse.department = req.user.department;
  } else if (req.user.role === 'manager') {
    userResponse.companyName = req.user.companyName;
    userResponse.position = req.user.position;
  }

  res.json({ user: userResponse });
}

module.exports = { register, login, me };
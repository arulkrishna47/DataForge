const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { generateToken, clearToken } = require('../utils/token');
const { sendVerificationEmail } = require('../utils/emailService');

// @desc Register user
// @route POST /api/auth/register
// @access Public
const registerUser = async (req, res) => {
  const { firstName, lastName, email, password, role } = req.body;

  const userExists = await prisma.user.findUnique({
    where: { email },
  });

  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Automatically assign ADMIN role if email matches ADMIN_EMAIL
  let userRole = role || 'client';
  if (email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase()) {
    userRole = 'ADMIN';
  }

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: userRole,
      isVerified: false,
      verificationOTP: otp,
    },
  });

  if (user) {
    try {
      await sendVerificationEmail(user.email, otp);
    } catch (err) {
      console.error('Failed to send verification email:', err);
    }

    // 🔥 FIX: Issue a token immediately so the subsequent /services request succeeds
    generateToken(res, user.id);

    res.status(201).json({
      message: 'Registration successful. Your session is active, please check email for verification code.',
      requiresVerification: true,
      email: user.email,
      id: user.id
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
};

// @desc Auth user & get token
// @route POST /api/auth/login
// @access Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user && (await bcrypt.compare(password, user.password))) {
    if (!user.isVerified) {
      // Allow legacy test users to bypass verification if they were made before this feature
      if (user.verificationOTP === null) {
        await prisma.user.update({ where: { email }, data: { isVerified: true } });
      } else {
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        await prisma.user.update({
          where: { email },
          data: { verificationOTP: newOtp },
        });
        try {
          await sendVerificationEmail(user.email, newOtp);
        } catch (err) {
          console.error('Failed to resend verification email on login:', err);
        }
        return res.status(403).json({ 
          message: 'Please verify your email first. A fresh OTP code has been sent to your inbox.', 
          requiresVerification: true, 
          email: user.email 
        });
      }
    }
    
    // Force update user role to ADMIN if email matches ADMIN_EMAIL (for existing users)
    if (user.email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase() && user.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' }
      });
      user.role = 'ADMIN';
    }

    generateToken(res, user.id);
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    });
  } else {
    res.status(401).json({ message: 'Invalid email or password' });
  }
};

// @desc Logout user
// @route POST /api/auth/logout
// @access Public
const logoutUser = (req, res) => {
  clearToken(res);
  res.status(200).json({ message: 'Logged out successfully' });
};

// @desc Get user profile
// @route GET /api/auth/profile
// @access Private
const getUserProfile = async (req, res) => {
  const user = {
    id: req.user.id,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    email: req.user.email,
    role: req.user.role,
  };
  res.json(user);
};

const verifyEmail = async (req, res) => {
  const { email, otp } = req.body;
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  if (user.isVerified) {
    return res.status(400).json({ message: 'Email is already verified' });
  }
  
  if (user.verificationOTP !== otp) {
    return res.status(401).json({ message: 'Invalid verification code' });
  }
  
  await prisma.user.update({
    where: { email },
    data: {
      isVerified: true,
      verificationOTP: null,
    },
  });
  
  generateToken(res, user.id);
  res.status(200).json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  });
};

const { sendContactEmail } = require('../utils/emailService');

const handleContactInquiry = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message is required.' });
  
  await sendContactEmail({ message });
  res.json({ message: 'Success' });
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  verifyEmail,
  handleContactInquiry,
};

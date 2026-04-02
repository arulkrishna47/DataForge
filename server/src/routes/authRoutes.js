const express = require('express');
const {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  verifyEmail,
  handleContactInquiry,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify', verifyEmail);
router.post('/logout', logoutUser);
router.post('/contact', handleContactInquiry);
router.get('/profile', protect, getUserProfile);

module.exports = router;

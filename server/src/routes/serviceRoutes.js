const express = require('express');
const { 
  createServiceRequest, 
  getServiceRequests, 
  updateServiceRequestStatus,
  handleQuickAction,
  testEmailSystem 
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/action/:id/:action', handleQuickAction);
router.get('/debug/test-email', (req, res, next) => {
  // Simple check for existence of keys
  const config = {
    hasUser: !!process.env.SMTP_USER,
    hasPass: !!process.env.SMTP_PASS,
    adminEmail: process.env.ADMIN_EMAIL,
    host: process.env.SMTP_HOST || 'smtp.gmail.com'
  };
  req.debugConfig = config;
  next();
}, require('../controllers/serviceController').testEmailSystem);

router.get('/debug/network-scan', require('../controllers/serviceController').scanNetwork);

router.route('/')
  .post(protect, createServiceRequest)
  .get(protect, getServiceRequests);

router.put('/:id', protect, authorize('ADMIN'), updateServiceRequestStatus);

module.exports = router;

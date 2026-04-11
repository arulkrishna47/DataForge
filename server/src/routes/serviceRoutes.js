const express = require('express');
const { 
  createServiceRequest, 
  getServiceRequests, 
  updateServiceRequestStatus,
  handleQuickAction 
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Put public quick actions ABOVE protected routes
router.get('/action/:id/:action', handleQuickAction);

router.route('/')
  .post(protect, createServiceRequest)
  .get(protect, getServiceRequests);

router.put('/:id', protect, authorize('ADMIN'), updateServiceRequestStatus);

module.exports = router;

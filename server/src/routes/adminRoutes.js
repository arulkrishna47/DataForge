const express = require('express');
const { getAnalytics, getClients, createInvoice } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, authorize('ADMIN'));

router.get('/analytics', getAnalytics);
router.get('/clients', getClients);
router.post('/invoices', createInvoice);

module.exports = router;

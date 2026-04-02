const express = require('express');
const {
  createProject,
  getProjects,
  updateProject,
  uploadDeliverable,
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, getProjects)
  .post(protect, authorize('ADMIN'), createProject);

router.put('/:id', protect, authorize('ADMIN'), updateProject);
router.post('/:id/upload', protect, authorize('ADMIN'), upload.single('deliverable'), uploadDeliverable);

module.exports = router;

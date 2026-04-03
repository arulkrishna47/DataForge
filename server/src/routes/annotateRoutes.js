const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const prisma = require('../db');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const fs = require('fs');

const router = express.Router();
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// POST /api/annotate/start
router.post(
  '/start',
  protect,
  upload.array('files', 100),
  async (req, res) => {
    try {
      const { labels, export_format } = req.body;
      const files = req.files;

      if (!files?.length) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      if (!labels) {
        return res.status(400).json({ error: 'Labels are required' });
      }

      // Forward to Python AI service
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', 
          fs.createReadStream(file.path),
          file.originalname
        );
      });
      formData.append('labels', labels);
      formData.append('export_format', export_format || 'yolo');

      const response = await axios.post(
        `${AI_SERVICE_URL}/annotate`,
        formData,
        { headers: formData.getHeaders(), timeout: 300000 }
      );

      // Save job to DB
      await prisma.annotationJob.create({
        data: {
          jobId: response.data.job_id,
          userId: req.user.id,
          labels: labels,
          exportFormat: export_format || 'yolo',
          status: 'PROCESSING',
          totalFiles: files.length,
        }
      });

      return res.json(response.data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to start annotation job' });
    }
  }
);

// GET /api/annotate/status/:jobId
router.get(
  '/status/:jobId',
  protect,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const response = await axios.get(
        `${AI_SERVICE_URL}/job/${jobId}`
      );
      return res.json(response.data);
    } catch {
      return res.status(500).json({ error: 'Failed to get job status' });
    }
  }
);

// GET /api/annotate/download/:jobId
router.get(
  '/download/:jobId',
  protect,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const response = await axios.get(
        `${AI_SERVICE_URL}/download/${jobId}`,
        { responseType: 'stream' }
      );
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cortexa_annotations_${jobId.slice(0,8)}.zip"`
      );
      response.data.pipe(res);
    } catch {
      return res.status(500).json({ error: 'Download failed' });
    }
  }
);

module.exports = router;

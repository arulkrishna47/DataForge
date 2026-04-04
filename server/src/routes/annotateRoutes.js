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

// IMPORTANT: Do NOT add a trailing slash here
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// POST /api/annotate/start
router.post(
  '/start',
  protect,
  upload.array('files', 100),
  async (req, res) => {
    let job_id_clean;
    try {
      const { labels, export_format } = req.body;
      const files = req.files;

      if (!files?.length) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      if (!labels) {
        return res.status(400).json({ error: 'Labels are required' });
      }

      console.log(`[DEBUG] Starting Job: ${files.length} files. Target: ${AI_SERVICE_URL}/annotate`);

      // 1. Prepare Data for AI Brain
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', fs.createReadStream(file.path), file.originalname);
      });
      formData.append('labels', labels);
      formData.append('export_format', export_format || 'yolo');

      // 2. Call AI Brain (Hugging Face)
      const response = await axios.post(
        `${AI_SERVICE_URL}/annotate`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 600000 // 10 minutes for heavy uploads
        }
      );

      job_id_clean = response.data.job_id;

      // 3. Convert labels string to proper array for Prisma database
      const labelArray = labels.split(',').map(l => l.trim()).filter(l => l);

      // 4. Save job to Supabase (Database)
      await prisma.annotationJob.create({
        data: {
          jobId: job_id_clean,
          userId: req.user.id,
          labels: labels, // Error fix: Prisma needs an ARRAY, not a string
          exportFormat: export_format || 'yolo',
          status: 'PROCESSING',
          totalFiles: files.length,
        }
      });

      console.log(`[DEBUG] Job Created Successfully: ${job_id_clean}`);
      return res.json(response.data);

    } catch (err) {
      console.error("[ERROR] Annotation Route Failed:", err.message);
      if (err.response) console.error("[ERROR] AI Brain returned:", err.response.data);

      return res.status(500).json({
        error: 'Failed to start annotation job',
        details: err.message
      });
    } finally {
      // Clean up uploaded files from the server disk
      if (req.files) {
        req.files.forEach(f => fs.unlink(f.path, () => { }));
      }
    }
  }
);

// GET /api/annotate/status/:jobId
// Updated to match the new "/annotate/status" route on Hugging Face
router.get(
  '/status/:jobId',
  protect,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const response = await axios.get(`${AI_SERVICE_URL}/annotate/status/${jobId}`);
      return res.json(response.data);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to get job status' });
    }
  }
);

// GET /api/annotate/download/:jobId
// Updated to match the new "/annotate/download" route on Hugging Face
router.get(
  '/download/:jobId',
  protect,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const response = await axios.get(
        `${AI_SERVICE_URL}/annotate/download/${jobId}`,
        { responseType: 'stream' }
      );
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="cortexa_${jobId.slice(0, 8)}.zip"`);
      response.data.pipe(res);
    } catch (err) {
      return res.status(500).json({ error: 'Download failed' });
    }
  }
);

module.exports = router;

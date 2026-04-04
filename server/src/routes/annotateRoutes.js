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

      if (!files?.length) return res.status(400).json({ error: 'No files uploaded' });
      if (!labels) return res.status(400).json({ error: 'Labels are required' });

      console.log(`[DEBUG] Step 1: Forwarding to AI Brain: ${AI_SERVICE_URL}/annotate`);

      // 1. Prepare Data
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', fs.createReadStream(file.path), file.originalname);
      });
      formData.append('labels', labels);
      formData.append('export_format', export_format || 'yolo');

      // 2. Call AI Brain
      const response = await axios.post(
        `${AI_SERVICE_URL}/annotate`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 600000 // 10 minutes
        }
      );

      job_id_clean = response.data.job_id;
      console.log("[DEBUG] Step 2: AI Brain accepted the job. ID:", job_id_clean);

      // 3. Save to Database
      // Using String() on everything to prevent Prisma type mismatches
      await prisma.annotationJob.create({
        data: {
          jobId: String(job_id_clean),
          userId: req.user.id,
          labels: String(labels),
          exportFormat: String(export_format || 'yolo'),
          status: 'PROCESSING',
          totalFiles: files.length,
        }
      });

      console.log("[DEBUG] Step 3: Database Job Created Successfully!");
      return res.json(response.data);

    } catch (err) {
      console.error("[CRITICAL ERROR] Annotation Route Failed!");
      console.error("-> Message:", err.message);

      // Detailed error for Prisma vs AI Brain
      if (err.code && err.code.startsWith('P')) {
        console.error("-> Database Error Detail:", err);
        return res.status(500).json({ error: 'Database error while saving job', details: err.message });
      }

      if (err.response) {
        console.error("-> AI Brain Error Detail:", err.response.data);
        return res.status(err.response.status).json({ error: 'AI Brain Error', details: err.response.data });
      }

      return res.status(500).json({ error: 'System Error', details: err.message });
    } finally {
      // Clean up uploads
      if (req.files) {
        req.files.forEach(f => fs.unlink(f.path, () => { }));
      }
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
      const response = await axios.get(`${AI_SERVICE_URL}/annotate/status/${jobId}`);
      return res.json(response.data);
    } catch (err) {
      console.error("[DEBUG] Status Poll Failed for Job:", req.params.jobId);
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
        `${AI_SERVICE_URL}/annotate/download/${jobId}`,
        { responseType: 'stream' }
      );
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="cortexa_${jobId.slice(0, 8)}.zip"`);
      response.data.pipe(res);
    } catch (err) {
      console.error("[DEBUG] Download Failed for Job:", req.params.jobId);
      return res.status(500).json({ error: 'Download failed' });
    }
  }
);

module.exports = router;

const prisma = require('../db');
const { sendNewServiceRequestAdminEmail, sendProjectAcceptedEmail, sendRequestAcceptedEmail, sendRequestDeclinedEmail } = require('../utils/emailService');

// @desc Create service request
// @route POST /api/services
// @access Private (Client)
const createServiceRequest = async (req, res) => {
  console.log('🚀 [HEARTBEAT] New service request incoming!');
  const { serviceType, scope, timeline, budget } = req.body;
  
  console.log('User attempting to create service request:', req.user?.email || req.body.email || 'Guest');
  console.log('Payload:', { serviceType, scope, timeline, budget });

  try {
    let finalClientId = req.user?.id;
    let currentUser = req.user;

    // Retry logic for guests (handles the race condition if register is still committing)
    if (!finalClientId && req.body.email) {
      console.log(`[DB_DEBUG] Searching for user: ${req.body.email}`);
      currentUser = await prisma.user.findUnique({ where: { email: req.body.email } });
      
      if (!currentUser) {
        console.log('[DB_DEBUG] User not found yet, waiting 1s for commit...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentUser = await prisma.user.findUnique({ where: { email: req.body.email } });
      }
      
      finalClientId = currentUser?.id;
    }

    if (!finalClientId) {
       console.error('[CRITICAL] No Client ID found for request. Body:', JSON.stringify(req.body));
       return res.status(400).json({ message: 'User account not found. Please ensure registration is complete.' });
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        serviceType,
        scope,
        timeline,
        budget: budget || 'N/A',
        clientId: finalClientId,
      },
    });

    // Send email notification to admin (Awaited for Serverless compatibility)
    const adminEmailToNotify = process.env.ADMIN_EMAIL || 'cortexa.services@gmail.com';
    try {
      await sendNewServiceRequestAdminEmail(adminEmailToNotify, serviceRequest, currentUser || { email: 'Guest User' });
      console.log('✅ Admin notification sent');
    } catch (err) {
      console.error('❌ SMTP Error:', err.message);
    }

    return res.status(201).json(serviceRequest);
  } catch (err) {
    console.error('🚀 [CRITICAL] Service Request Failed:', err.message);
    return res.status(500).json({ 
        message: 'Request failed to save. Please try again.',
        debug: err.message
    });
  }
};

// @desc Get all service requests
// @route GET /api/services
// @access Private (Admin only or Client's own)
const getServiceRequests = async (req, res) => {
  let requests;
  if (req.user.role === 'ADMIN') {
    requests = await prisma.serviceRequest.findMany({
      include: { client: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  } else {
    requests = await prisma.serviceRequest.findMany({
      where: { clientId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
  }
  res.json(requests);
};

// @desc Update service request status
// @route PUT /api/services/:id
// @access Private (Admin)
const updateServiceRequestStatus = async (req, res) => {
  const { status } = req.body;
  
  try {
    const updated = await prisma.serviceRequest.update({
      where: { id: req.params.id },
      data: { status },
      include: { client: true },
    });

    if (updated.client) {
      const clientName = updated.client.name || updated.client.email.split('@')[0];
      if (status === 'Accepted') {
        await sendRequestAcceptedEmail(updated.client.email, clientName, updated.serviceType);
      } else if (status === 'Declined') {
        await sendRequestDeclinedEmail(updated.client.email, clientName, updated.serviceType);
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Error updating status', error: err.message });
  }
};

// @desc Quick action from email
// @route GET /api/services/action/:id/:action
// @access Public (tokenized or direct link in this version)
const handleQuickAction = async (req, res) => {
  const { id, action } = req.params;
  const status = action === 'accept' ? 'Accepted' : 'Declined';

  try {
    const updated = await prisma.serviceRequest.update({
      where: { id },
      include: { client: true },
      data: { status }
    });

    const clientName = updated.client.name || updated.client.email.split('@')[0];

    if (action === 'accept') {
      await sendRequestAcceptedEmail(updated.client.email, clientName, updated.serviceType);
    } else {
      await sendRequestDeclinedEmail(updated.client.email, clientName, updated.serviceType);
    }

    res.send(`
      <div style="background-color: #0D0B1A; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
        <h1 style="color: #C17BFF; font-size: 40px; margin-bottom: 20px;">CORTEXA ACTION</h1>
        <p style="font-size: 20px; color: #94A3B8;">Request has been successfully <strong>${status}</strong>.</p>
        <p style="margin-top: 20px; color: #64748B;">Client has been notified via email.</p>
        <a href="${process.env.VITE_URL || 'http://localhost:5174'}/admin" style="background-color: #C17BFF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 12px; margin-top: 30px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Return to Admin Dashboard</a>
      </div>
    `);
  } catch (err) {
    console.error('Quick Action Error:', err.message);
    res.status(400).send('Error processing request action.');
  }
};

// @desc Test email system
const testEmailSystem = async (req, res) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'cortexa.services@gmail.com';
  console.log('--- EMAIL DEBUG INITIATED ---');
  console.log('Sending to:', adminEmail);
  console.log('SMTP Config Status:', req.debugConfig);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ 
          error: 'SMTP credentials missing from environment variables!',
          config: req.debugConfig
      });
  }

  try {
    const info = await sendNewServiceRequestAdminEmail(adminEmail, {
          id: 'TEST-ID',
          serviceType: 'System Test',
          scope: 'Testing production connectivity',
          timeline: 'Now',
          budget: 'N/A'
      }, { email: 'System Debugger', name: 'Test User' });

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.json({ 
          message: 'Test email successfully handed off to Gmail!',
          timestamp: new Date().toISOString(),
          recipient: adminEmail,
          accepted: info?.accepted,
          rejected: info?.rejected,
          messageId: info?.messageId,
          server_config: req.debugConfig 
      });
  } catch (err) {
      console.error('SMTP TEST FAILED:', err.message);
      res.status(500).json({ 
          message: 'SMTP Test Failed', 
          error: err.message,
          config: req.debugConfig
      });
  }
};

const scanNetwork = async (req, res) => {
    const net = require('net');
    const targets = [
        { host: 'smtp.gmail.com', port: 587 },
        { host: 'smtp.gmail.com', port: 465 },
        { host: 'smtp.mailtrap.io', port: 2525 },
        { host: 'smtp.sendgrid.net', port: 2525 },
        { host: 'google.com', port: 443 },
        { host: 'google.com', port: 80 }
    ];

    const results = await Promise.all(targets.map(target => {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const start = Date.now();
            socket.setTimeout(5000);

            socket.on('connect', () => {
                const duration = Date.now() - start;
                socket.destroy();
                resolve({ ...target, status: 'OPEN', duration: `${duration}ms` });
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve({ ...target, status: 'TIMEOUT' });
            });

            socket.on('error', (err) => {
                socket.destroy();
                resolve({ ...target, status: 'ERROR', message: err.message });
            });

            socket.connect(target.port, target.host);
        });
    }));

    res.json({
        message: "Render Outbound Network Scan",
        timestamp: new Date().toISOString(),
        results
    });
};

module.exports = {
  createServiceRequest,
  getServiceRequests,
  updateServiceRequestStatus,
  handleQuickAction,
  testEmailSystem,
  scanNetwork
};

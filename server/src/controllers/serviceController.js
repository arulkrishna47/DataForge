const prisma = require('../db');
const { sendNewServiceRequestAdminEmail, sendProjectAcceptedEmail, sendProjectDeclinedEmail } = require('../utils/emailService');

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
      const clientObj = { name: clientName, email: updated.client.email };
      
      if (status === 'Accepted') {
        await sendProjectAcceptedEmail(clientObj, updated);
      } else if (status === 'Declined') {
        await sendProjectDeclinedEmail(clientObj, updated);
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
    const clientObj = { name: clientName, email: updated.client.email };

    if (action === 'accept') {
      await sendProjectAcceptedEmail(clientObj, updated);
    } else {
      await sendProjectDeclinedEmail(clientObj, updated);
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
    res.status(500).send('Error processing action: ' + err.message);
  }
};

module.exports = {
  createServiceRequest,
  getServiceRequests,
  updateServiceRequestStatus,
  handleQuickAction
};

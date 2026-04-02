const prisma = require('../db');
const { sendNewServiceRequestAdminEmail, sendProjectAcceptedEmail, sendRequestAcceptedEmail, sendRequestDeclinedEmail } = require('../utils/emailService');

// @desc Create service request
// @route POST /api/services
// @access Private (Client)
const createServiceRequest = async (req, res) => {
  const { serviceType, scope, timeline, budget } = req.body;
  
  console.log('User attempting to create service request:', req.user.email);
  console.log('Payload:', { serviceType, scope, timeline, budget });

  try {
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        serviceType,
        scope,
        timeline,
        budget: budget || 'N/A',
        clientId: req.user.id,
      },
    });
    console.log('Successfully created service request:', serviceRequest.id);

    // Fire and forget email notification to avoid blocking client response
    const adminEmailToNotify = process.env.ADMIN_EMAIL || 'cortexa.services@gmail.com';
    sendNewServiceRequestAdminEmail(adminEmailToNotify, serviceRequest, req.user).then(() => {
        console.log('Admin notification sent to:', adminEmailToNotify);
    }).catch(error => {
        console.error('Error sending admin notification:', error.message);
    });

    res.status(201).json(serviceRequest);
  } catch (err) {
    console.error('Failed to create service request in DB:', err.message);
    res.status(500).json({ message: 'Database submission failed', error: err.message });
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
        <a href="${process.env.VITE_URL || 'http://localhost:5173'}/admin" style="background-color: #C17BFF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 12px; margin-top: 30px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Return to Admin Dashboard</a>
      </div>
    `);
  } catch (err) {
    res.status(400).send('Error processing request action.');
  }
};

module.exports = {
  createServiceRequest,
  getServiceRequests,
  updateServiceRequestStatus,
  handleQuickAction,
};

const prisma = require('../db');

// @desc Get analytics
// @route GET /api/admin/analytics
// @access Private (Admin)
const getAnalytics = async (req, res) => {
  try {
    const requestCount = await prisma.serviceRequest.count();
    const projectCount = await prisma.project.count();
    // Role enum in Prisma schema is uppercase: CLIENT, ADMIN
    const clientCount = await prisma.user.count({ where: { role: 'CLIENT' } });
    
    const statusCounts = await prisma.project.groupBy({
      by: ['status'],
      _count: true,
    });

    res.json({
      counts: {
        requests: requestCount,
        projects: projectCount,
        clients: clientCount,
      },
      statusBreakdown: statusCounts,
    });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ message: 'Analytics query failed', error: err.message });
  }
};

// @desc Get all clients
// @route GET /api/admin/clients
// @access Private (Admin)
const getClients = async (req, res) => {
  try {
    // Role enum in Prisma schema is uppercase: CLIENT
    const clients = await prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    res.json(clients);
  } catch (err) {
    console.error('getClients error:', err.message);
    res.status(500).json({ message: 'Failed to fetch clients', error: err.message });
  }
};

// @desc Invoicing (dummy for now)
const createInvoice = async (req, res) => {
  const { amount, projectId, dueDate } = req.body;
  const invoice = await prisma.invoice.create({
    data: {
      amount,
      projectId,
      dueDate: new Date(dueDate),
    },
  });
  res.json(invoice);
};

module.exports = {
  getAnalytics,
  getClients,
  createInvoice,
};

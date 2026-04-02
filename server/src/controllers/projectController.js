const prisma = require('../db');

// @desc Create project
// @route POST /api/projects
// @access Private (Admin)
const createProject = async (req, res) => {
  const { title, description, clientId } = req.body;
  const project = await prisma.project.create({
    data: {
      title,
      description,
      clientId,
    },
  });
  res.status(201).json(project);
};

// @desc Get all projects
// @route GET /api/projects
// @access Private
const getProjects = async (req, res) => {
  let projects;
  if (req.user.role === 'ADMIN') {
    projects = await prisma.project.findMany({
      include: { client: { select: { name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  } else {
    projects = await prisma.project.findMany({
      where: { clientId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
  }
  res.json(projects);
};

// @desc Update project status and deliverables
// @route PUT /api/projects/:id
// @access Private (Admin)
const updateProject = async (req, res) => {
  const { status, deliverables } = req.body;
  const updated = await prisma.project.update({
    where: { id: req.params.id },
    data: { 
      status,
      // If deliverables is passed as an array
      deliverables: deliverables || undefined,
    },
  });
  res.json(updated);
};

const { sendDeliverableUploadedEmail } = require('../utils/emailService');

// @desc Upload deliverable to project
// @route POST /api/projects/:id/upload
// @access Private (Admin)
const uploadDeliverable = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const project = await prisma.project.findUnique({ 
    where: { id: req.params.id },
    include: { client: true }
  });
  
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const updatedDeliverables = [...(project.deliverables || []), req.file.path];

  const updated = await prisma.project.update({
    where: { id: req.params.id },
    data: { deliverables: updatedDeliverables, status: 'Delivered' },
  });

  // Notify client of new asset shipment
  if (project.client) {
    await sendDeliverableUploadedEmail(project.client, project);
  }

  res.json(updated);
};

module.exports = {
  createProject,
  getProjects,
  updateProject,
  uploadDeliverable,
};

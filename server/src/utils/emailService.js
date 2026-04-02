const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendProjectAcceptedEmail = async (user, project) => {
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #C17BFF; font-size: 24px; border-bottom: 2px solid #C17BFF; padding-bottom: 10px; margin-bottom: 30px;">Project Initiated: ${project.title}</h1>
      <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${user.name || user.email.split('@')[0]}</strong>,</p>
      <p style="font-size: 16px; line-height: 1.6;">Your project <strong>${project.title}</strong> has been officially initiated. Our team is now working on your requirements.</p>
      <div style="margin-top: 40px;">
        <a href="${process.env.VITE_URL || 'http://localhost:5174'}/dashboard" style="background-color: #C17BFF; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">View Project Status</a>
      </div>
    </div>
  `;
  await sendEmail(user.email, `Cortexa: Project Initiated [${project.title}]`, html);
};

const sendDeliverableUploadedEmail = async (user, project, deliverable) => {
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #C17BFF; font-size: 24px; border-bottom: 2px solid #C17BFF; padding-bottom: 10px; margin-bottom: 30px;">New Deliverable Available</h1>
      <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${user.name || user.email.split('@')[0]}</strong>,</p>
      <p style="font-size: 16px; line-height: 1.6;">A new asset <strong>${deliverable.title}</strong> has been uploaded to your project <strong>${project.title}</strong>.</p>
      <div style="margin-top: 40px;">
        <a href="${process.env.VITE_URL || 'http://localhost:5174'}/dashboard" style="background-color: #C17BFF; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">Download Assets</a>
      </div>
    </div>
  `;
  await sendEmail(user.email, `New Asset Uploaded: ${deliverable.title}`, html);
};

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Cortexa | AI Platform" <${process.env.SMTP_USER || 'no-reply@cortexa.ai'}>`,
      to,
      subject,
      html,
    });
    console.log(`Email Service: Sent [${subject}] to [${to}]. Id: ${info.messageId}`);
  } catch (err) {
    console.error(`Email Service Error: [${subject}] to [${to}] failed.`, err.message);
  }
};

const sendRequestAcceptedEmail = async (clientEmail, clientName, serviceName) => {
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #22C55E; font-size: 24px; border-bottom: 2px solid #22C55E; padding-bottom: 10px; margin-bottom: 30px;">Service Request Accepted</h1>
      <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${clientName}</strong>,</p>
      <p style="font-size: 16px; line-height: 1.6;">Your request for <strong>${serviceName}</strong> has been <strong>ACCEPTED</strong> by our team.</p>
      <p style="font-size: 16px; line-height: 1.6;">Our team will now begin the production phase. You can track all updates directly in your dashboard.</p>
      <div style="margin-top: 40px;">
        <a href="${process.env.VITE_URL || 'http://localhost:5174'}/dashboard" style="background-color: #C17BFF; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">Go To Dashboard</a>
      </div>
    </div>
  `;
  await sendEmail(clientEmail, `Your Cortexa Request for ${serviceName} was Accepted!`, html);
};

const sendRequestDeclinedEmail = async (clientEmail, clientName, serviceName) => {
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #EF4444; font-size: 24px; border-bottom: 2px solid #EF4444; padding-bottom: 10px; margin-bottom: 30px;">Service Request Update</h1>
      <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${clientName}</strong>,</p>
      <p style="font-size: 16px; line-height: 1.6;">Thank you for your interest in <strong>${serviceName}</strong>. At this time, we are unable to proceed with your specific requirement as submitted.</p>
      <p style="font-size: 16px; line-height: 1.6;">You can log in to your dashboard to view more details or submit a revised request.</p>
    </div>
  `;
  await sendEmail(clientEmail, `Update regarding your Cortexa request for ${serviceName}`, html);
};

const sendNewServiceRequestAdminEmail = async (adminEmail, request, clientInfo) => {
  const baseUrl = process.env.VITE_API_URL || 'http://localhost:5000/api';
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #C17BFF; font-size: 24px; border-bottom: 2px solid #C17BFF; padding-bottom: 10px; margin-bottom: 30px;">New Service Request Submitted</h1>
      <p style="font-size: 16px; line-height: 1.6;">Hello Admin,</p>
      <p style="font-size: 16px; line-height: 1.6;">A new service request has been submitted by <strong>${clientInfo.name || clientInfo.email.split('@')[0]}</strong> (${clientInfo.email}).</p>
      
      <div style="background-color: #1E293B; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #334155;">
        <p style="margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Request Details</p>
        <p style="margin: 10px 0 0 0; font-size: 18px; color: #ffffff; font-weight: bold;">Type: ${request.serviceType}</p>
        <p style="margin: 10px 0 0 0; font-size: 16px; color: #cbd5e1;">Scope: ${request.scope}</p>
        <p style="margin: 5px 0 0 0; font-size: 16px; color: #cbd5e1;">Timeline: ${request.timeline}</p>
        <p style="margin: 5px 0 0 0; font-size: 16px; color: #cbd5e1;">Budget: ${request.budget}</p>
      </div>
      
      <div style="margin-top: 40px; border-top: 1px solid #1E293B; padding-top: 20px;">
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">Quick Actions:</p>
        <a href="${baseUrl}/services/action/${request.id}/accept" style="background-color: #22C55E; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; margin-right: 15px; display: inline-block;">ACCEPT REQUEST</a>
        <a href="${baseUrl}/services/action/${request.id}/decline" style="background-color: #EF4444; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">DECLINE REQUEST</a>
      </div>

      <p style="margin-top: 30px;"><a href="${process.env.VITE_URL || 'http://localhost:5174'}/admin" style="color: #C17BFF; text-decoration: underline; font-size: 13px;">Open Admin Dashboard</a></p>
    </div>
  `;
  await sendEmail(adminEmail, `New Service Request: ${request.serviceType}`, html);
};

const sendVerificationEmail = async (email, otp) => {
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #C17BFF; font-size: 24px; border-bottom: 2px solid #C17BFF; padding-bottom: 10px; margin-bottom: 30px;">Verify Your Email</h1>
      <p style="font-size: 16px; line-height: 1.6;">Hello!</p>
      <p style="font-size: 16px; line-height: 1.6;">Thank you for registering at Cortexa. Please use the following One-Time Password to verify your email address:</p>
      
      <div style="background-color: #1E293B; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #334155; text-align: center;">
        <p style="margin: 0; font-size: 32px; color: #ffffff; font-weight: bold; letter-spacing: 5px;">${otp}</p>
      </div>
      
      <p style="font-size: 16px; line-height: 1.6;">This code is valid for 10 minutes.</p>
    </div>
  `;
  await sendEmail(email, `Cortexa Verification Code: ${otp}`, html);
};

const sendContactEmail = async (messageData) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER; // Send to admin
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #C17BFF; font-size: 24px; border-bottom: 2px solid #C17BFF; padding-bottom: 10px; margin-bottom: 30px;">New Contact Form Message</h1>
      <p style="font-size: 16px; line-height: 1.6;">You have received a new message from the Cortexa contact form:</p>
      
      <div style="background-color: #1E293B; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #334155;">
        <p style="margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">User Message</p>
        <p style="margin: 15px 0 0 0; font-size: 16px; color: #ffffff; line-height: 1.6;">${messageData.message}</p>
      </div>

       <p style="font-size: 14px; color: #64748B;">Sent from: Anonymous / Public User</p>
    </div>
  `;
  await sendEmail(adminEmail, `Cortexa Support: New Message`, html);
};

module.exports = {
  sendProjectAcceptedEmail,
  sendDeliverableUploadedEmail,
  sendNewServiceRequestAdminEmail,
  sendVerificationEmail,
  sendRequestAcceptedEmail,
  sendRequestDeclinedEmail,
  sendContactEmail,
};

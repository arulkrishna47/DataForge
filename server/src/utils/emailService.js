const { Resend } = require('resend');

// Initialize Resend with API Key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Resend has a strict "From" address policy. 
 * Since we haven't verified a custom domain yet, we use their default sender.
 * This will reliably deliver to your inbox (cortexa.services@gmail.com).
 */
const DEFAULT_SENDER = 'Cortexa <onboarding@resend.dev>';

const sendEmail = async (to, subject, html) => {
  try {
    console.log(`[RESEND] Attempting to send [${subject}] to [${to}]`);
    
    const { data, error } = await resend.emails.send({
      from: DEFAULT_SENDER,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('[RESEND_ERROR]', error);
      throw error;
    }

    console.log(`[RESEND_SUCCESS] Message sent! ID: ${data.id}`);
    return {
        messageId: data.id,
        accepted: [to],
        rejected: []
    };
  } catch (err) {
    console.error(`[RESEND_FAILURE] Failed to send [${subject}] to [${to}].`, err.message);
    throw err;
  }
};

const sendProjectAcceptedEmail = async (user, project) => {
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #C17BFF; font-size: 24px; border-bottom: 2px solid #C17BFF; padding-bottom: 10px; margin-bottom: 30px;">Project Accepted!</h1>
      <p style="font-size: 16px;">Hello ${user.name},</p>
      <p style="font-size: 16px;">Your service request for <strong>${project.serviceType}</strong> has been accepted.</p>
      <p style="font-size: 16px;">Our team will reach out to you shortly with more details.</p>
      <div style="margin-top: 30px; border-top: 1px solid #1E293B; padding-top: 20px;">
        <p style="color: #94a3b8; font-size: 12px;">Thank you for choosing Cortexa.</p>
      </div>
    </div>
  `;
  await sendEmail(user.email, `Good news! Your project was accepted`, html);
};

const sendProjectDeclinedEmail = async (user, project) => {
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #EF4444; font-size: 24px; border-bottom: 2px solid #EF4444; padding-bottom: 10px; margin-bottom: 30px;">Project Update</h1>
      <p style="font-size: 16px;">Hello ${user.name},</p>
      <p style="font-size: 16px;">We reviewed your service request for <strong>${project.serviceType}</strong> and unfortunately, we won't be able to fulfill it at this time.</p>
      <p style="font-size: 16px;">You can log in to your dashboard to view more details or submit a revised request.</p>
    </div>
  `;
  await sendEmail(user.email, `Update regarding your Cortexa request`, html);
};

const sendNewServiceRequestAdminEmail = async (adminEmail, request, clientInfo) => {
  const baseUrl = process.env.VITE_API_URL || 'https://cortexa-server-7u1x.onrender.com/api';
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #C17BFF; font-size: 24px; border-bottom: 2px solid #C17BFF; padding-bottom: 10px; margin-bottom: 30px;">New Service Request Submitted</h1>
      <p style="font-size: 16px;">Hello Admin,</p>
      <p style="font-size: 16px;">A new service request has been submitted by <strong>${clientInfo.name || clientInfo.email}</strong>.</p>
      
      <div style="background-color: #1E293B; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #334155;">
        <p style="margin: 0; font-size: 18px; color: #ffffff; font-weight: bold;">Type: ${request.serviceType}</p>
        <p style="margin: 10px 0 0 0; font-size: 16px; color: #cbd5e1;">Scope: ${request.scope}</p>
        <p style="margin: 5px 0 0 0; font-size: 16px; color: #cbd5e1;">Timeline: ${request.timeline}</p>
        <p style="margin: 5px 0 0 0; font-size: 16px; color: #cbd5e1;">Budget: ${request.budget}</p>
      </div>
      
      <div style="margin-top: 40px;">
        <a href="${baseUrl}/services/action/${request.id}/accept" style="display: inline-block; background-color: #22C55E; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">Accept Request</a>
        <a href="${baseUrl}/services/action/${request.id}/decline" style="display: inline-block; background-color: #EF4444; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Decline Request</a>
      </div>
    </div>
  `;
  return await sendEmail(adminEmail, `New Service Request: ${request.serviceType}`, html);
};

const sendVerificationEmail = async (email, otp) => {
  const html = `
    <div style="background-color: #0F172A; color: #ffffff; padding: 40px; font-family: sans-serif; border-radius: 10px;">
      <h1 style="color: #C17BFF; font-size: 24px; border-bottom: 2px solid #C17BFF; padding-bottom: 10px; margin-bottom: 30px;">Verify your email</h1>
      <p style="font-size: 16px;">Your verification code is: <strong style="font-size: 32px; color: #C17BFF;">${otp}</strong></p>
    </div>
  `;
  await sendEmail(email, 'Cortexa Email Verification', html);
};

module.exports = {
  sendProjectAcceptedEmail,
  sendProjectDeclinedEmail,
  sendNewServiceRequestAdminEmail,
  sendVerificationEmail
};

require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function testEmail() {
  console.log('Testing SMTP connection with:');
  console.log('User:', process.env.SMTP_USER);
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);

  try {
    const info = await transporter.sendMail({
      from: `"Cortexa Diagnostic" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "DIAGNOSTIC TEST: Cortexa Notification Engine",
      text: "If you are reading this, your SMTP configuration is working correctly.",
      html: "<h1>SMTP SUCCESS</h1><p>Your Cortexa notification engine is connected.</p>"
    });
    console.log('SUCCESS! Message sent:', info.messageId);
  } catch (error) {
    console.error('SMTP FAILURE:', error);
  }
}

testEmail();

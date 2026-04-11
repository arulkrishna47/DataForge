require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function testEmail() {
  console.log('Attempting to send test email...');
  console.log('To:', process.env.ADMIN_EMAIL);
  console.log('From:', process.env.SMTP_USER);
  
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: 'Cortexa Email System Test',
      text: 'If you receive this, the email system is working correctly with port 465.',
      html: '<b>If you receive this, the email system is working correctly with port 465.</b>'
    });
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ Email failed:', err.message);
    if (err.message.includes('465')) {
       console.log('Retrying with port 587 (non-secure start)...');
       const transporter2 = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // TLS
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        try {
           const info2 = await transporter2.sendMail({
              from: process.env.SMTP_USER,
              to: process.env.ADMIN_EMAIL,
              subject: 'Cortexa Email System Test (Port 587)',
              text: 'Port 465 failed, but 587 worked.'
           });
           console.log('✅ Port 587 worked!');
        } catch (err2) {
           console.error('❌ Port 587 also failed:', err2.message);
        }
    }
  }
}

testEmail();

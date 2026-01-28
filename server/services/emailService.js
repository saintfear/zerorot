const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Strip quotes from .env values (dotenv sometimes includes them)
    const emailUser = String(process.env.EMAIL_USER || '').replace(/^["']|["']$/g, '').trim();
    const emailPass = String(process.env.EMAIL_PASS || '').replace(/^["']|["']$/g, '').trim();
    
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
  }

  /**
   * Send newsletter email
   */
  async sendNewsletter(userEmail, subject, htmlContent) {
    // Check if email is configured (strip quotes)
    const emailUser = String(process.env.EMAIL_USER || '').replace(/^["']|["']$/g, '').trim();
    const emailPass = String(process.env.EMAIL_PASS || '').replace(/^["']|["']$/g, '').trim();
    if (!emailUser || !emailPass) {
      throw new Error('Email not configured. Please set EMAIL_USER and EMAIL_PASS in .env');
    }

    try {
      const emailUser = String(process.env.EMAIL_USER || '').replace(/^["']|["']$/g, '').trim();
      const mailOptions = {
        from: `"ZeroRot" <${emailUser}>`,
        to: userEmail,
        subject: subject,
        html: this.wrapInTemplate(htmlContent)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Newsletter sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending email:', error.message);
      // Provide more helpful error messages
      if (error.code === 'EAUTH') {
        throw new Error('Email authentication failed. Check your EMAIL_USER and EMAIL_PASS in .env');
      } else if (error.code === 'ECONNECTION') {
        throw new Error('Could not connect to email server. Check EMAIL_HOST and EMAIL_PORT in .env');
      }
      throw error;
    }
  }

  /**
   * Wrap content in a beautiful email template
   */
  wrapInTemplate(content) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Email-safe, editorial/minimal style inspired by giga design studio */
    body {
      margin: 0;
      padding: 0;
      background: #f3f0ea; /* warm paper */
      color: #14110f;      /* near-black ink */
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .wrap {
      width: 100%;
      padding: 28px 12px;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      background: #fffaf0;
      border: 2px solid #d4c4a8;
      border-radius: 16px;
      overflow: hidden;
    }
    .topbar {
      padding: 22px 22px 14px;
      border-bottom: 1px solid #e3d8c6;
      background: #fff6e6;
    }
    .brand {
      font-size: 12px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #4a3d2e;
      margin: 0 0 10px 0;
    }
    .title {
      font-size: 26px;
      line-height: 1.15;
      margin: 0;
      letter-spacing: -0.02em;
      color: #14110f;
    }
    .sub {
      margin: 10px 0 0 0;
      font-size: 13px;
      color: #6b5b4a;
    }
    .content {
      padding: 22px;
    }
    /* Make common blocks look like “cards” even if content provides its own markup */
    .content h2, .content h3 {
      color: #14110f;
      letter-spacing: -0.01em;
    }
    .content a {
      color: #4a3d2e;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .content a:hover { opacity: 0.85; }
    .footer {
      padding: 18px 22px 22px;
      border-top: 1px solid #e3d8c6;
      background: #fff6e6;
      font-size: 12px;
      color: #6b5b4a;
    }
    .footer p { margin: 6px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="container">
      <div class="topbar">
        <p class="brand">ZeroRot</p>
        <h1 class="title">Your daily signal</h1>
        <p class="sub">Curated posts matched to your taste — with quick rating buttons.</p>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p><strong>ZeroRot</strong> — you’re receiving this because you signed up.</p>
        <p>If you didn’t request this, you can ignore the email.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email server is ready');
      return true;
    } catch (error) {
      console.error('❌ Email server connection failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService();

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
    /* Warm vintage “typewriter + antiqued glass” */
    body {
      margin: 0;
      padding: 0;
      background: #f6efe1; /* parchment */
      color: #2b231a;      /* warm ink */
      font-family: "Courier New", Courier, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      line-height: 1.6;
    }
    .wrap {
      width: 100%;
      padding: 28px 12px;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      background: #fff7e8;
      border: 2px solid #d7c4a1;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 28px rgba(43,35,26,0.10);
    }
    .glass {
      background: rgba(255, 246, 230, 0.72);
      border-bottom: 1px solid #e5d2b3;
      padding: 18px 20px 14px;
    }
    .mast {
      font-family: Georgia, "Times New Roman", Times, serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-size: 12px;
      color: #6b5b4a;
      margin: 0 0 8px 0;
    }
    .title {
      margin: 0;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 0.02em;
      color: #2b231a;
    }
    .sub {
      margin: 10px 0 0 0;
      font-size: 13px;
      color: #6b5b4a;
    }
    .content {
      padding: 18px 20px 8px;
    }
    /* Gentle defaults for content blocks */
    .content h2, .content h3 {
      font-family: Georgia, "Times New Roman", Times, serif;
      color: #2b231a;
      margin: 16px 0 8px;
    }
    .content p {
      margin: 10px 0;
      color: #2b231a;
    }
    .content a {
      color: #6a3e2a;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .rule {
      height: 1px;
      background: #ead9bf;
      margin: 14px 0;
    }
    .footer {
      padding: 14px 20px 18px;
      border-top: 1px solid #e5d2b3;
      background: rgba(255, 246, 230, 0.72);
      font-size: 12px;
      color: #6b5b4a;
    }
    .footer p { margin: 6px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="container">
      <div class="glass">
        <p class="mast">ZeroRot · daily newsletter</p>
        <h1 class="title">Today’s picks</h1>
        <p class="sub">A warm little bundle of posts picked for your taste. Tap 👍 / 👎 right from your inbox.</p>
      </div>
      <div class="content">
        <div class="rule"></div>
        ${content}
      </div>
      <div class="footer">
        <p><strong>ZeroRot</strong> — you’re receiving this because you signed up.</p>
        <p>Tip: rating from the email teaches ZeroRot what to send you next.</p>
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

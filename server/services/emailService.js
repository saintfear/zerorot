const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Send newsletter email
   */
  async sendNewsletter(userEmail, subject, htmlContent) {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Email not configured. Please set EMAIL_USER and EMAIL_PASS in .env');
    }

    try {
      const mailOptions = {
        from: `"ZeroRot" <${process.env.EMAIL_USER}>`,
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
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }
    .header h1 {
      color: #6366f1;
      margin: 0;
      font-size: 28px;
    }
    .content {
      margin: 20px 0;
    }
    .post-card {
      margin: 25px 0;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background-color: #fafafa;
    }
    .post-card img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    .post-card h3 {
      margin-top: 0;
      color: #1f2937;
    }
    .post-card a {
      color: #6366f1;
      text-decoration: none;
      font-weight: 500;
    }
    .post-card a:hover {
      text-decoration: underline;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ ZeroRot</h1>
      <p style="color: #6b7280; margin: 5px 0;">Your daily dose of curated content</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Made with ❤️ by ZeroRot</p>
      <p>You're receiving this because you signed up for ZeroRot.</p>
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

// Email Service - Email notification backup for WhatsApp

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
}

let emailConfig: EmailConfig | null = null;

export function configureEmail(config: EmailConfig): void {
  emailConfig = config;
}

export function isEmailConfigured(): boolean {
  return emailConfig !== null && !!emailConfig.host && !!emailConfig.auth.user;
}

export async function sendEmail(options: EmailOptions): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn("Email not configured, skipping email send");
    return { ok: false, error: "Email not configured" };
  }

  try {
    // Dynamic import nodemailer for optional dependency
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: emailConfig!.host,
      port: emailConfig!.port,
      secure: emailConfig!.secure,
      auth: {
        user: emailConfig!.auth.user,
        pass: emailConfig!.auth.pass,
      },
    });

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const info = await transporter.sendMail({
      from: emailConfig!.from,
      to: recipients.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(", "),
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    });

    return { ok: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send email:", message);
    return { ok: false, error: message };
  }
}

// Email templates
export function ratingAlertTemplate(data: {
  ratingType: string;
  referenceLabel: string;
  generalRating: number;
  comment?: string;
  submittedAt: string;
}): { subject: string; html: string } {
  return {
    subject: `[Rating Alert] ${data.ratingType} - ${data.generalRating}/5`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0f1d3a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .rating { font-size: 48px; text-align: center; color: #f58f3d; }
          .comment { background: white; padding: 15px; border-radius: 8px; margin-top: 15px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Rating Received</h1>
          </div>
          <div class="content">
            <div class="rating">${data.generalRating}/5</div>
            <p><strong>Type:</strong> ${data.ratingType}</p>
            <p><strong>Reference:</strong> ${data.referenceLabel}</p>
            <p><strong>Submitted:</strong> ${new Date(data.submittedAt).toLocaleString("id-ID")}</p>
            ${data.comment ? `
              <div class="comment">
                <strong>Comment:</strong>
                <p>${data.comment}</p>
              </div>
            ` : ""}
          </div>
          <div class="footer">
            <p>Grand Sunshine Hospitality System</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export function voucherDeliveryTemplate(data: {
  guestName: string;
  validDate: string;
  voucherCodes: string[];
}): { subject: string; html: string } {
  return {
    subject: `[Voucher] Breakfast Voucher for ${data.validDate}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0d8c74; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .voucher-code { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 16px; text-align: center; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Breakfast Voucher</h1>
          </div>
          <div class="content">
            <p>Dear ${data.guestName},</p>
            <p>Here is your breakfast voucher for <strong>${data.validDate}</strong>:</p>
            ${data.voucherCodes.map((code) => `<div class="voucher-code">${code}</div>`).join("")}
            <p>Please show this voucher at the restaurant during breakfast hours.</p>
          </div>
          <div class="footer">
            <p>Grand Sunshine Hotel</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export function thankYouTemplate(data: {
  guestName: string;
  ratingType: string;
}): { subject: string; html: string } {
  return {
    subject: `Thank you for your ${data.ratingType} rating`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f58f3d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; text-align: center; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You!</h1>
          </div>
          <div class="content">
            <p>Dear ${data.guestName},</p>
            <p>Thank you for taking the time to share your feedback about your ${data.ratingType} experience.</p>
            <p>We value your input and will use it to improve our services.</p>
            <p>We hope to welcome you again soon!</p>
          </div>
          <div class="footer">
            <p>Grand Sunshine Hotel</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}
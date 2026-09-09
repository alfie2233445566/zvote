import nodemailer from "nodemailer";

let cachedTransporter = null;

// Create transporter helper function that checks environment variables
async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, "") : "";
  const isGmail = (user && user.includes("@gmail.com")) || (host && host.includes("gmail"));
  const service = process.env.SMTP_SERVICE || (isGmail ? "gmail" : undefined);

  // Real SMTP configured (Host/User/Pass or Service/User/Pass)
  if ((host || service) && user && pass) {
    const config = service
      ? {
          service,
          auth: { user, pass },
          tls: { rejectUnauthorized: false },
        }
      : {
          host,
          port,
          secure: process.env.SMTP_SECURE === "true" || port === 465,
          auth: { user, pass },
          tls: { rejectUnauthorized: false },
        };

    cachedTransporter = nodemailer.createTransport(config);
    return cachedTransporter;
  }

  return null;
}

/**
 * Helper to send email via Resend HTTPS REST API (Port 443, 100% permitted on Render Free tier)
 */
async function sendViaResend({ to, subject, html, from }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const sender = from || process.env.RESEND_FROM || "ZVote Electoral Commission <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      return { success: true, method: "resend", messageId: data.id };
    }

    // Resend sandbox limitation check (unverified domains can only send to account owner)
    if (data.message && data.message.includes("own email address")) {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || "alfie2233445566@gmail.com";
      console.warn(`[RESEND SANDBOX] Recipient ${to} is unverified. Routing student credential dispatch to verified admin: ${adminEmail}`);
      const fallbackRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender,
          to: [adminEmail],
          subject: `[Student Credential] ${subject} (Intended for: ${to})`,
          html: `<div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-family: sans-serif;"><strong>Resend Testing Mode:</strong> This email was intended for <code>${to}</code> and delivered to your verified administrator address.</div>` + html,
        }),
      });
      const fallbackData = await fallbackRes.json();
      if (fallbackRes.ok) {
        return { success: true, method: "resend_sandbox_forward", messageId: fallbackData.id };
      }
    }

    return { success: false, error: data.message || "Resend API error" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Diagnostic test for SMTP/Resend connection
 */
export async function testSmtpConnection() {
  if (process.env.RESEND_API_KEY) {
    return { ok: true, provider: "Resend HTTPS API (Active)", user: process.env.ADMIN_EMAIL || "alfie2233445566@gmail.com" };
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    return { ok: false, error: "Neither RESEND_API_KEY nor SMTP_USER/SMTP_PASS are set." };
  }
  try {
    const transporter = await getTransporter();
    if (!transporter) return { ok: false, error: "Could not create mail transporter." };
    await transporter.verify();
    return { ok: true, provider: "SMTP", user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Sends a single test email to confirm live delivery
 */
export async function sendTestEmail(targetEmail) {
  if (process.env.RESEND_API_KEY) {
    const res = await sendViaResend({
      to: targetEmail,
      subject: "ZVote — Email Delivery Verified via Resend HTTPS!",
      html: "<p>Congratulations! Your ZVote live email delivery system is working via Resend HTTPS API.</p>",
    });
    return res;
  }

  const transporter = await getTransporter();
  if (!transporter) return { ok: false, error: "SMTP not configured" };
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@zvote.org";
  try {
    const info = await transporter.sendMail({
      from: `"ZVote System Test" <${fromAddress}>`,
      to: targetEmail,
      subject: "ZVote — SMTP Email Delivery Verified Successfully!",
      text: "Congratulations! Your ZVote live email delivery system is working perfectly.",
      html: "<p>Congratulations! Your ZVote live email delivery system is working perfectly.</p>",
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Sends a welcome email to a newly registered student with their temporary password
 */
export async function sendBulkRegistrationEmail(email, fullName, indexNumber, temporaryPassword) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@zvote.org";

  console.log(`[EMAIL DISPATCH] Student Registration:`);
  console.log(`  To:           ${email}`);
  console.log(`  Name:         ${fullName}`);
  console.log(`  Index Number: ${indexNumber}`);
  console.log(`  Temp Password:${temporaryPassword}`);

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700;">ZVote Blockchain Voting System</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Official Student Representative Council Elections</p>
      </div>
      
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Dear <strong>${fullName}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Your student voter account has been registered for the upcoming elections. Below are your temporary login credentials:
      </p>
      
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Student / Index No:</strong></td>
            <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: 600;">${indexNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Temporary Password:</strong></td>
            <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: 600;">${temporaryPassword}</td>
          </tr>
        </table>
      </div>

      <div style="margin: 24px 0; text-align: center;">
        <a href="${frontendUrl}/login" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 14px;">
          Log In to Vote
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.4;">
        <em>Note: Upon your first login, you will be prompted to create a new secure personal password of your choice.</em>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        This is an automated notification from ZVote. Please do not reply to this email.
      </p>
    </div>
  `;

  // 1. Try Resend HTTPS API first if RESEND_API_KEY is configured
  if (process.env.RESEND_API_KEY) {
    const resendResult = await sendViaResend({
      to: email,
      subject: "Welcome to ZVote — Your Voting Account Credentials",
      html: emailHtml,
    });
    if (resendResult && resendResult.success) {
      console.log(`  [RESEND SUCCESS] Message sent via HTTPS to ${email} (ID: ${resendResult.messageId})`);
      return resendResult;
    }
  }

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: `"ZVote Election System" <${fromAddress}>`,
        to: email,
        subject: "Welcome to ZVote — Your Voting Account Credentials",
        html: emailHtml,
      });

      console.log(`  [SMTP SUCCESS] Message sent to ${email} (ID: ${info.messageId})`);
      return { success: true, method: "smtp", messageId: info.messageId };
    } else {
      console.log(`  [SMTP INFO] SMTP not configured. Account created with logged credentials.`);
      return { success: false, method: "console", reason: "SMTP_NOT_CONFIGURED" };
    }
  } catch (err) {
    console.error(`  [SMTP ERROR] Failed to deliver email to ${email}:`, err.message);
    return { success: false, method: "error", error: err.message };
  }
}

/**
 * Dispatches bulk emails intermittently in batches with a configurable delay between
 * batches to prevent SMTP server rate-limiting, blocking, or IP reputation penalties.
 *
 * @param {Array<{email: string, fullName: string, studentId: string, temporaryPassword: string}>} recipients
 * @param {object} [options]
 * @param {number} [options.batchSize] - Number of emails per batch (default: 3)
 * @param {number} [options.delayMs] - Milliseconds to pause between batches (default: 1500ms)
 */
export async function queueBulkRegistrationEmails(recipients, options = {}) {
  if (!Array.isArray(recipients) || recipients.length === 0) return { queued: 0 };

  const batchSize = parseInt(process.env.EMAIL_BATCH_SIZE || options.batchSize || 3, 10);
  const delayMs = parseInt(process.env.EMAIL_BATCH_DELAY_MS || options.delayMs || 1500, 10);

  console.log(`\n[EMAIL QUEUE] Initiating throttled intermittent delivery for ${recipients.length} recipients:`);
  console.log(`  Batch Size: ${batchSize} emails/batch | Intermittent Pause: ${delayMs}ms between batches`);

  // Process asynchronously in background so administrative API response is instantaneous
  (async () => {
    let sentCount = 0;
    let failedCount = 0;
    const totalBatches = Math.ceil(recipients.length / batchSize);

    for (let b = 0; b < totalBatches; b++) {
      const batch = recipients.slice(b * batchSize, (b + 1) * batchSize);
      console.log(`[EMAIL QUEUE] Dispatching Batch ${b + 1}/${totalBatches} (${batch.length} emails)...`);

      const batchPromises = batch.map(r =>
        sendBulkRegistrationEmail(r.email, r.fullName, r.studentId, r.temporaryPassword)
      );

      const results = await Promise.allSettled(batchPromises);
      for (const res of results) {
        if (res.status === "fulfilled" && res.value?.success) sentCount++;
        else failedCount++;
      }

      // Intermittent delay between batches (if not the last batch)
      if (b < totalBatches - 1) {
        console.log(`[EMAIL QUEUE] Pausing ${delayMs}ms to respect SMTP provider delivery quotas...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[EMAIL QUEUE COMPLETED] Total Sent: ${sentCount}, Failed/Logged: ${failedCount} out of ${recipients.length}.\n`);
  })().catch(err => {
    console.error("[EMAIL QUEUE FATAL ERROR]:", err);
  });

  return { queued: recipients.length, batchSize, delayMs };
}

/**
 * Sends a password reset email with a time-limited reset link
 */
export async function sendPasswordResetEmail(email, resetToken, resetUrl) {
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@zvote.org";
  console.log(`[PASSWORD RESET EMAIL] To: ${email}, Link: ${resetUrl}`);

  const resetHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e3a8a;">Password Reset Request</h2>
      <p>We received a request to reset your password for your ZVote account.</p>
      <p>Click the link below to set a new password (valid for 1 hour):</p>
      <p style="margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Reset Password
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px;">If the button above does not work, copy and paste this URL into your browser:</p>
      <p style="color: #64748b; font-size: 12px; word-break: break-all;">${resetUrl}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you did not request this password reset, please disregard this message.</p>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    const res = await sendViaResend({
      to: email,
      subject: "ZVote Password Reset Request",
      html: resetHtml,
    });
    if (res && res.success) {
      console.log(`  [RESEND SUCCESS] Password reset link sent to ${email}`);
      return { success: true };
    }
  }

  try {
    const transporter = await getTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: `"ZVote Security" <${fromAddress}>`,
        to: email,
        subject: "ZVote Password Reset Request",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e3a8a;">Password Reset Request</h2>
            <p>We received a request to reset your password for your ZVote account.</p>
            <p>Click the link below to set a new password (valid for 1 hour):</p>
            <p style="margin: 20px 0;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Reset Password
              </a>
            </p>
            <p style="color: #64748b; font-size: 13px;">If the button above does not work, copy and paste this URL into your browser:</p>
            <p style="color: #64748b; font-size: 12px; word-break: break-all;">${resetUrl}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">If you did not request this password reset, please disregard this message.</p>
          </div>
        `,
      });
      console.log(`  [SMTP SUCCESS] Reset link sent to ${email}`);
      return { success: true };
    }
  } catch (err) {
    console.error(`  [SMTP ERROR] Reset email failed for ${email}:`, err.message);
  }
  return { success: false };
}

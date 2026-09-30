const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Verify connection on service initialization
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP Transporter Verification Warning:', error.message);
    } else {
        console.log('✅ SMTP Transporter Ready for sending emails as:', process.env.SMTP_USER);
    }
});

/**
 * Send Welcome Email with Credentials to Newly Created User/Admin
 * Optimized for High Deliverability & Anti-Spam Compliance
 */
async function sendWelcomeEmail({ email, name, roleName, password, phone, portalUrl }) {
    if (!email) {
        console.warn('⚠️ Cannot send welcome email: No recipient email provided.');
        return;
    }

    const loginUrl = portalUrl || process.env.APP_PORTAL_URL || 'https://sgbcrm.crafzio.in/';
    const fromName = process.env.SMTP_FROM_NAME || 'SGB Agro Industries';
    const fromAddress = process.env.SMTP_USER || 'veerendra.sgb@gmail.com';
    const formattedRole = roleName || 'CRM Account';

    // Anti-Spam Compliant HTML Email Template (Table-based layout, no aggressive gradients/emojis)
    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>SGB Agro CRM - Account Credentials</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: Arial, Helvetica, sans-serif; color: #1e293b;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 20px 0;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background-color: #064e3b; padding: 25px 20px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">SGB Agro Industries</h1>
                            <p style="color: #a7f3d0; margin: 5px 0 0 0; font-size: 13px;">Official Staff CRM Credentials</p>
                        </td>
                    </tr>
                    
                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 30px 25px;">
                            <p style="font-size: 16px; font-weight: bold; color: #0f172a; margin: 0 0 12px 0;">Hello ${name || 'Team Member'},</p>
                            <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px 0;">
                                Your staff account has been registered for the <strong>SGB Agro CRM Portal</strong>. You can now access your workspace using the credentials below:
                            </p>

                            <!-- Credentials Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #10b981; border-radius: 6px; padding: 15px; margin-bottom: 25px;">
                                <tr>
                                    <td style="font-size: 13px; font-weight: bold; color: #0f172a; text-transform: uppercase; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                                        Account Access Credentials
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 10px;">
                                        <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 14px;">
                                            <tr>
                                                <td width="130" style="color: #64748b; font-weight: bold;">Portal URL:</td>
                                                <td style="color: #2563eb;"><a href="${loginUrl}" style="color: #2563eb; text-decoration: underline;" target="_blank">${loginUrl}</a></td>
                                            </tr>
                                            <tr>
                                                <td style="color: #64748b; font-weight: bold;">Login Email:</td>
                                                <td style="color: #0f172a; font-weight: bold;">${email}</td>
                                            </tr>
                                            ${phone ? `
                                            <tr>
                                                <td style="color: #64748b; font-weight: bold;">Phone Number:</td>
                                                <td style="color: #0f172a;">${phone}</td>
                                            </tr>` : ''}
                                            <tr>
                                                <td style="color: #64748b; font-weight: bold;">Assigned Role:</td>
                                                <td style="color: #059669; font-weight: bold;">${formattedRole}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #64748b; font-weight: bold;">Password:</td>
                                                <td style="color: #0f172a;"><span style="background-color: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-weight: bold;">${password}</span></td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                                <tr>
                                    <td align="center">
                                        <table border="0" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="center" style="background-color: #10b981; border-radius: 6px;">
                                                    <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: bold; border-radius: 6px;">LOG IN TO CRM PORTAL</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Security Notice -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 12px 15px;">
                                <tr>
                                    <td style="font-size: 12px; color: #92400e; line-height: 1.4;">
                                        <strong>Security Note:</strong> Please keep your credentials safe. We recommend updating your password after logging in for the first time.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #f1f5f9; padding: 15px 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                            <p style="margin: 0 0 4px 0;"><strong>SGB Agro Industries</strong></p>
                            <p style="margin: 0 0 4px 0;">SGB Industries Office, Koppa Rural, KOPPA 577126</p>
                            <p style="margin: 0;">Support Email: <a href="mailto:${fromAddress}" style="color: #059669; text-decoration: none;">${fromAddress}</a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    const textContent = `
SGB Agro Industries - CRM Account Credentials

Hello ${name},

Your staff account has been created successfully for the SGB Agro CRM Portal.

Portal URL: ${loginUrl}
Login Email: ${email}
Phone Number: ${phone || 'N/A'}
Assigned Role: ${formattedRole}
Password: ${password}

Log in here: ${loginUrl}

Security Note: Please keep your credentials safe and update your password upon first login.

Regards,
SGB Agro Industries
SGB Industries Office, Koppa Rural, KOPPA 577126
Contact: ${fromAddress}
    `;

    // Unique Message-ID domain for anti-spam compliance
    const msgDomain = 'sgbcrm.crafzio.in';
    const uniqueMsgId = `<sgb-welcome-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@${msgDomain}>`;

    const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        replyTo: fromAddress,
        subject: `SGB Agro CRM - Your Account Credentials`,
        text: textContent,
        html: htmlContent,
        headers: {
            'Message-ID': uniqueMsgId,
            'X-Mailer': 'SGB Agro CRM Transactional Mailer v1.0',
            'X-Priority': '3',
            'X-MSMail-Priority': 'Normal',
            'Importance': 'Normal'
        }
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Welcome email sent to inbox of ${email} (Message ID: ${info.messageId})`);
        return info;
    } catch (error) {
        console.error(`❌ Email send error to ${email}:`, error.message);
        throw error;
    }
}

/**
 * Send 4-digit OTP Security Email for Password Reset / Change
 */
async function sendOtpEmail({ email, name, otp, purpose = 'Password Reset' }) {
    if (!email || !otp) {
        console.warn('⚠️ Cannot send OTP email: Missing email or OTP code.');
        return;
    }

    const fromName = process.env.SMTP_FROM_NAME || 'SGB Agro Industries';
    const fromAddress = process.env.SMTP_USER || 'veerendra.sgb@gmail.com';

    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>SGB Agro CRM - Password Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: Arial, Helvetica, sans-serif; color: #1e293b;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 20px 0;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background-color: #064e3b; padding: 25px 20px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">SGB Agro Industries</h1>
                            <p style="color: #a7f3d0; margin: 5px 0 0 0; font-size: 13px;">Verification & Password Authorization</p>
                        </td>
                    </tr>
                    
                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 30px 25px;">
                            <p style="font-size: 16px; font-weight: bold; color: #0f172a; margin: 0 0 12px 0;">Hello ${name || 'Team Member'},</p>
                            <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px 0;">
                                A request was made to update your <strong>SGB Agro CRM Account Password</strong>. Use the 4-digit verification code below to authorize this change:
                            </p>

                            <!-- OTP Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
                                <tr>
                                    <td align="center">
                                        <div style="font-size: 12px; font-weight: bold; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your 4-Digit OTP Code</div>
                                        <div style="font-size: 36px; font-weight: 800; color: #047857; letter-spacing: 8px; font-family: monospace;">${otp}</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Valid for 10 minutes. Do not share this code with anyone.</div>
                                    </td>
                                </tr>
                            </table>

                            <!-- Security Notice -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 12px 15px;">
                                <tr>
                                    <td style="font-size: 12px; color: #92400e; line-height: 1.4;">
                                        <strong>Didn't request this code?</strong> If you did not initiate a password reset, please contact your System Administrator immediately.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #f1f5f9; padding: 15px 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                            <p style="margin: 0 0 4px 0;"><strong>SGB Agro Industries</strong></p>
                            <p style="margin: 0 0 4px 0;">SGB Industries Office, Koppa Rural, KOPPA 577126</p>
                            <p style="margin: 0;">Support Email: <a href="mailto:${fromAddress}" style="color: #059669; text-decoration: none;">${fromAddress}</a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    const textContent = `
SGB Agro Industries - Password Verification Code

Hello ${name},

Your 4-digit verification code to update your password is: ${otp}

This code is valid for 10 minutes. If you did not request a password change, please ignore this email or contact support.

Regards,
SGB Agro Industries
SGB Industries Office, Koppa Rural, KOPPA 577126
Contact: ${fromAddress}
    `;

    const msgDomain = 'sgbcrm.crafzio.in';
    const uniqueMsgId = `<sgb-otp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@${msgDomain}>`;

    const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        replyTo: fromAddress,
        subject: `SGB Agro CRM - Password Reset OTP (${otp})`,
        text: textContent,
        html: htmlContent,
        headers: {
            'Message-ID': uniqueMsgId,
            'X-Mailer': 'SGB Agro CRM Transactional Mailer v1.0',
            'X-Priority': '1',
            'X-MSMail-Priority': 'High',
            'Importance': 'High'
        }
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent to ${email} (OTP: ${otp}, Message ID: ${info.messageId})`);
        return info;
    } catch (error) {
        console.error(`❌ OTP Email send error to ${email}:`, error.message);
        throw error;
    }
}

module.exports = {
    transporter,
    sendWelcomeEmail,
    sendOtpEmail
};

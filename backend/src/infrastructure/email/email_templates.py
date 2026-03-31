def build_welcome_email_html(
    name: str,
    employee_id: str,
    email: str,
    otp: str,
    app_url: str,
    role: str = "",
    department: str = "",
    company_name: str = "TaskFlow",
) -> str:
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to TaskFlow</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap');
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:'Lexend','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:36px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">TaskFlow</span>
              <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;">Team Task Management</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 20px;">
              <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#1a1a2e;">
                Welcome aboard, {name}!
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7194;">
                You have been added to <strong style="color:#1a1a2e;">{company_name}</strong>.
              </p>

              <!-- Role & Department Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #e0e7ff;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:50%;padding:4px 0;">
                          <p style="margin:0;font-size:10px;font-weight:700;color:#9ca3bf;text-transform:uppercase;letter-spacing:1.5px;">Your Role</p>
                          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#4f46e5;">{role}</p>
                        </td>
                        <td style="width:50%;padding:4px 0;">
                          <p style="margin:0;font-size:10px;font-weight:700;color:#9ca3bf;text-transform:uppercase;letter-spacing:1.5px;">Department</p>
                          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#4f46e5;">{department}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Credentials Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8fb;border:1px solid #ebebf0;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#9ca3bf;text-transform:uppercase;letter-spacing:1.5px;">
                      Your Login Credentials
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#6b7194;width:140px;">Employee ID</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a2e;font-family:monospace;">{employee_id}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#6b7194;">Email</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a2e;">{email}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#6b7194;">One-Time Password</td>
                        <td style="padding:6px 0;">
                          <span style="display:inline-block;padding:6px 16px;font-size:16px;font-weight:700;color:#4f46e5;background-color:#eef2ff;border-radius:8px;font-family:monospace;letter-spacing:2px;">{otp}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="{app_url}/login" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.3px;">
                      Log In to TaskFlow
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instructions -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ebebf0;">
                <tr>
                  <td style="padding:20px 0 0;">
                    <p style="margin:0 0 8px;font-size:13px;color:#6b7194;line-height:1.5;">
                      <strong style="color:#1a1a2e;">How to get started:</strong>
                    </p>
                    <ol style="margin:0;padding:0 0 0 20px;font-size:13px;color:#6b7194;line-height:1.8;">
                      <li>Click the login button above</li>
                      <li>Enter your email or Employee ID</li>
                      <li>Enter the one-time password shown above</li>
                      <li>Create your own new password</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="padding:12px 16px;background-color:#fef3c7;border-radius:8px;border:1px solid #fde68a;">
                    <p style="margin:0;font-size:12px;color:#92400e;">
                      <strong>Important:</strong> This one-time password expires in 7 days. Please log in and set your own password before then.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;text-align:center;border-top:1px solid #f0f0f5;">
              <p style="margin:0 0 4px;font-size:13px;color:#6b7194;">
                Powered by <strong style="color:#4f46e5;">NEUROSTACK</strong>
              </p>
              <p style="margin:0;font-size:11px;color:#c0c4d8;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def build_welcome_email_text(
    name: str,
    employee_id: str,
    email: str,
    otp: str,
    app_url: str,
    role: str = "",
    department: str = "",
    company_name: str = "TaskFlow",
) -> str:
    return f"""\
Welcome to TaskFlow, {name}!

You have been added to {company_name}.

Your Role       : {role}
Department      : {department}

Your Login Credentials:

  Employee ID      : {employee_id}
  Email            : {email}
  One-Time Password: {otp}

How to get started:
1. Go to {app_url}/login
2. Enter your email or Employee ID
3. Enter the one-time password above
4. Create your own new password

Important: This one-time password expires in 7 days.

Powered by NEUROSTACK
This is an automated message. Please do not reply."""

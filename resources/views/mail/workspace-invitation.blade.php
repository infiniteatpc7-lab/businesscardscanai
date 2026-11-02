<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Invitation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.5;
            color: #18181b;
            background-color: #f4f4f5;
            margin: 0;
            padding: 24px;
        }
        .container {
            max-width: 520px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border: 1px solid #e4e4e7;
        }
        .header {
            margin-bottom: 24px;
        }
        .title {
            font-size: 20px;
            font-weight: 700;
            color: #09090b;
            margin: 0 0 8px 0;
        }
        .subtitle {
            font-size: 14px;
            color: #71717a;
            margin: 0;
        }
        .badge {
            display: inline-block;
            background: #f4f4f5;
            color: #18181b;
            font-size: 12px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 9999px;
            text-transform: capitalize;
        }
        .button {
            display: inline-block;
            background: #09090b;
            color: #ffffff !important;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 9999px;
            margin-top: 24px;
            margin-bottom: 24px;
        }
        .footer {
            font-size: 12px;
            color: #a1a1aa;
            margin-top: 24px;
            border-top: 1px solid #f4f4f5;
            padding-top: 16px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Workspace Invitation</h1>
            <p class="subtitle"><strong>{{ $inviter->name }}</strong> has invited you to collaborate.</p>
        </div>

        <p>You have been invited to join the workspace <strong>{{ $workspace->name }}</strong> with the role of <span class="badge">{{ $invitation->role }}</span>.</p>

        <p>With this role, you can scan business cards, view team contacts, and coordinate booth follow-ups.</p>

        <div style="text-align: center;">
            <a href="{{ $acceptUrl }}" class="button" target="_blank" rel="noopener noreferrer">Accept Invitation</a>
        </div>

        <p style="font-size: 13px; color: #71717a;">If the button above does not work, copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #2563eb; word-break: break-all;">{{ $acceptUrl }}</p>

        <div class="footer">
            <p>This invitation was sent to <strong>{{ $invitation->email }}</strong>. If you did not expect this email, you can safely ignore it.</p>
        </div>
    </div>
</body>
</html>

<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
                    <tr>
                        <td style="padding:24px 32px;border-bottom:1px solid #e4e4e7;">
                            <strong style="font-size:16px;">{{ config('app.name') }}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;font-size:14px;line-height:1.6;white-space:pre-wrap;">{{ $bodyText }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>

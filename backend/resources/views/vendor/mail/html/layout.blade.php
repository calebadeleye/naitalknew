<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
<title>{{ config('app.name') }}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
@media only screen and (max-width: 620px) {
.inner-body, .footer { width: 100% !important; }
.pad { padding-left: 22px !important; padding-right: 22px !important; }
.header-tagline { display: none !important; }
.feature { display: block !important; width: 100% !important; border-left: 0 !important; padding: 10px 0 !important; }
.help-text, .help-action { display: block !important; width: 100% !important; text-align: left !important; }
.help-action { padding-top: 14px !important; }
.footer-col { display: block !important; width: 100% !important; text-align: left !important; padding-bottom: 14px !important; }
.footer-links { text-align: left !important; }
.button { width: 100% !important; box-sizing: border-box; }
}
</style>
{!! $head ?? '' !!}
</head>
<body>

<table class="wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td align="center">
<table class="inner-body" align="center" width="640" cellpadding="0" cellspacing="0" role="presentation">
{!! $header ?? '' !!}

<!-- Email Body -->
<tr>
<td class="body">
{!! Illuminate\Mail\Markdown::parse($slot) !!}

{!! $subcopy ?? '' !!}
</td>
</tr>

{!! $footer ?? '' !!}
</table>
</td>
</tr>
</table>
</body>
</html>

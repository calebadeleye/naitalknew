@props(['url'])
@php($brand = config('mail.brand'))
<tr>
<td class="header">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="header-logo" valign="middle">
<a href="{{ $brand['site_url'] }}" style="display: inline-block; text-decoration: none;">
<img src="{{ $brand['asset_url'] }}/logo.png" width="180" alt="NAI TALK" style="display: block; width: 180px; max-width: 180px; height: auto; border: 0;">
</a>
</td>
<td class="header-tagline" align="right" valign="middle">
Let&rsquo;s talk<span class="tagline-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>We build<span class="tagline-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>You grow
</td>
</tr>
</table>
</td>
</tr>

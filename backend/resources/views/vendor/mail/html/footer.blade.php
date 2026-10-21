@php($brand = config('mail.brand'))
<tr>
<td class="footer-band">
<table class="footer" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="pad footer-top">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="footer-col" valign="middle">
<table cellpadding="0" cellspacing="0" role="presentation"><tr>
<td valign="middle" style="padding-right: 18px; border-right: 1px solid #4b5157;"><img src="{{ $brand['asset_url'] }}/logo-light.png" width="130" alt="NAI TALK" style="display: block; width: 130px; height: auto; border: 0;"></td>
<td valign="middle" class="footer-tagline" style="padding-left: 18px;">Let&rsquo;s talk<span class="tagline-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>We build<span class="tagline-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>You grow</td>
</tr></table>
</td>
<td class="footer-col" align="right" valign="middle">
<a href="https://facebook.com/naitalk" target="_blank" rel="noopener" style="display: inline-block; margin-left: 8px;"><img src="{{ $brand['asset_url'] }}/social-facebook.png" width="34" height="34" alt="Facebook" style="display: block; border: 0;"></a>
<a href="https://twitter.com/naitalkc" target="_blank" rel="noopener" style="display: inline-block; margin-left: 8px;"><img src="{{ $brand['asset_url'] }}/social-x.png" width="34" height="34" alt="X" style="display: block; border: 0;"></a>
<a href="https://www.linkedin.com/company/naitalk/" target="_blank" rel="noopener" style="display: inline-block; margin-left: 8px;"><img src="{{ $brand['asset_url'] }}/social-linkedin.png" width="34" height="34" alt="LinkedIn" style="display: block; border: 0;"></a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="pad footer-bottom">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="footer-col footer-copy" valign="middle">&copy; {{ date('Y') }} NAI TALK. All rights reserved.<br><span class="footer-address">7 Unity Rd, Off Command Rd, Ikola, Lagos &middot; info@naitalk.com &middot; 07087057654</span></td>
<td class="footer-col footer-links" align="right" valign="middle">
<a href="{{ $brand['site_url'] }}/privacy-policy">Privacy Policy</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="{{ $brand['site_url'] }}/terms-of-service">Terms of Service</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="{{ $brand['site_url'] }}/contact">Contact Support</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

@php($brand = config('mail.brand'))
<x-mail::layout>
{{-- Header --}}
<x-slot:header>
<x-mail::header :url="config('mail.brand.site_url')">
{{ config('app.name') }}
</x-mail::header>
</x-slot:header>

{{-- Body --}}
{!! $slot !!}

<table class="features" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="pad">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="feature" width="33%" valign="top">
<table cellpadding="0" cellspacing="0" role="presentation"><tr>
<td valign="top" width="52"><img src="{{ $brand['asset_url'] }}/icon-shield.png" width="44" height="44" alt="" style="display: block; border: 0;"></td>
<td valign="top"><p class="feature-title">Secure</p><p class="feature-text">Your data is safe with us.</p></td>
</tr></table>
</td>
<td class="feature feature-divided" width="34%" valign="top">
<table cellpadding="0" cellspacing="0" role="presentation"><tr>
<td valign="top" width="52"><img src="{{ $brand['asset_url'] }}/icon-support.png" width="44" height="44" alt="" style="display: block; border: 0;"></td>
<td valign="top"><p class="feature-title">Expert Support</p><p class="feature-text">Our team is always ready to help.</p></td>
</tr></table>
</td>
<td class="feature feature-divided" width="33%" valign="top">
<table cellpadding="0" cellspacing="0" role="presentation"><tr>
<td valign="top" width="52"><img src="{{ $brand['asset_url'] }}/icon-gear.png" width="44" height="44" alt="" style="display: block; border: 0;"></td>
<td valign="top"><p class="feature-title">Reliable Services</p><p class="feature-text">Built to support your business growth.</p></td>
</tr></table>
</td>
</tr>
</table>
</td>
</tr>
</table>

<table class="help" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="help-box">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="help-text" valign="middle">
<table cellpadding="0" cellspacing="0" role="presentation"><tr>
<td valign="middle" width="66"><img src="{{ $brand['asset_url'] }}/icon-chat.png" width="52" height="52" alt="" style="display: block; border: 0;"></td>
<td valign="middle"><p class="help-title">Need Help?</p><p class="help-sub">Our support team is available to assist you.</p></td>
</tr></table>
</td>
<td class="help-action" align="right" valign="middle">
<a href="{{ $brand['site_url'] }}/contact" class="button-outline" target="_blank" rel="noopener">Contact Support&nbsp;&nbsp;&rarr;</a>
</td>
</tr>
</table>
</td>
</tr>
</table>

{{-- Subcopy --}}
@isset($subcopy)
<x-slot:subcopy>
<x-mail::subcopy>
{!! $subcopy !!}
</x-mail::subcopy>
</x-slot:subcopy>
@endisset

{{-- Footer --}}
<x-slot:footer>
<x-mail::footer>
</x-mail::footer>
</x-slot:footer>
</x-mail::layout>

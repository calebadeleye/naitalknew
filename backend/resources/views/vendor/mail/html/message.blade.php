<x-mail::layout>
{{-- Header --}}
<x-slot:header>
<x-mail::header :url="config('app.url')">
{{ config('app.name') }}
</x-mail::header>
</x-slot:header>

{{-- Body --}}
{!! $slot !!}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="support-section">
<tr>
<td align="center">

<p>Need help? Our support team is ready to assist you.</p>
<p><a href="mailto:info@naitalk.com">Contact Support &rarr;</a></p>

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

<img src="{{ asset('assets/email/naitalk-logo.png') }}" width="110" alt="NAITALK" style="max-width: 110px; width: 110px; height: auto;">

<p class="brand-slogan-footer">Let&rsquo;s talk&nbsp;&nbsp;|&nbsp;&nbsp;we build&nbsp;&nbsp;|&nbsp;&nbsp;you grow.</p>

<p class="footer-brand-line">Reliable hosting, powerful solutions, and expert support to help your business grow online.</p>

<div class="footer-contact">
<p>info@naitalk.com</p>
<p>07087057654</p>
<p>www.naitalk.com</p>
<p>7 Unity Rd, Off Command Rd, Ikola, Lagos</p>
</div>

<p class="footer-copyright">&copy; {{ date('Y') }} NAI TALK. All rights reserved.</p>
<p class="footer-automated">This is an automated message, please do not reply.</p>

</x-mail::footer>
</x-slot:footer>
</x-mail::layout>

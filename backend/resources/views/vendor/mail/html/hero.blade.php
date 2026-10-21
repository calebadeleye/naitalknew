@props([
    'eyebrow' => 'Hello,',
    'intro' => 'This is a message from NAI TALK. If you have any questions, our support team is always ready to help.',
])
@php($brand = config('mail.brand'))
<table class="hero" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="hero-text pad" valign="middle" width="62%">
<p class="hero-eyebrow">{{ $eyebrow }}</p>
<h1 class="hero-title">We&rsquo;re here<br>for your <span class="hero-accent">success.</span></h1>
<p class="hero-intro">{{ $intro }}</p>
</td>
<td class="hero-art" valign="middle" align="right" width="38%">
<img src="{{ $brand['asset_url'] }}/hero.png" width="220" alt="" style="display: inline-block; width: 220px; max-width: 100%; height: auto; border: 0;">
</td>
</tr>
</table>

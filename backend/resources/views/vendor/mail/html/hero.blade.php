@props([
    'eyebrow' => 'Hello,',
])
{{-- Just the greeting, above the email's title (the owner found a brand headline here distracting). --}}
<table class="greeting" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="pad greeting-cell">
<p class="hero-eyebrow">{{ $eyebrow }}</p>
</td>
</tr>
</table>

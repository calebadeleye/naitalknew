<x-mail::message>
<x-mail::hero eyebrow="Hello," />

<table class="section" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="pad section-cell">
@foreach (preg_split("/\R{2,}/", trim($bodyText)) as $paragraph)
<p>{!! nl2br(e($paragraph)) !!}</p>
@endforeach
</td>
</tr>
</table>
</x-mail::message>

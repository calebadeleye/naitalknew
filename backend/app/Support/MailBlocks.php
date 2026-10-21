<?php

namespace App\Support;

use Illuminate\Support\HtmlString;

/**
 * Pieces of the branded email template that notifications drop into their
 * lines with ->line(MailBlocks::code(...)) — rendered as HTML (the template
 * passes HTML through) and styled to match resources/views/vendor/mail.
 */
class MailBlocks
{
    /** A code, temporary password or similar, in the dashed box with the lock icon. */
    public static function code(string $label, string $code, ?string $note = null): HtmlString
    {
        $icon = config('mail.brand.asset_url').'/icon-lock.png';

        return new HtmlString(
            '<table class="info-box" width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
            .'<td class="info-box-icon" width="84" valign="middle"><img src="'.e($icon).'" width="64" height="64" alt="" style="display:block;border:0;"></td>'
            .'<td valign="middle">'
            .'<p class="info-box-label">'.e($label).'</p>'
            .'<table cellpadding="0" cellspacing="0" role="presentation"><tr><td class="info-box-code">'.e($code).'</td></tr></table>'
            .($note ? '<p class="info-box-note">'.e($note).'</p>' : '')
            .'</td></tr></table>'
        );
    }
}

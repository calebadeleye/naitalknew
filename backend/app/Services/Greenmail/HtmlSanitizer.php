<?php

namespace App\Services\Greenmail;

use HTMLPurifier;
use HTMLPurifier_Config;

/**
 * Makes an incoming email's HTML safe to show: no scripts, forms, frames or
 * event handlers; links open in a new tab. The browser also shows it inside a
 * sandboxed iframe with a strict content policy — this is the second wall.
 *
 * Inline images (cid:…) are swapped for data: URIs from the message's own
 * attachments; remote images are kept, and the page blocks them until the
 * reader chooses "Show images".
 */
class HtmlSanitizer
{
    /**
     * @param  array<string, string>  $inlineImages  content-id => data: URI
     */
    public function clean(string $html, array $inlineImages = []): string
    {
        // Embedded (cid:) images are swapped for short placeholders while the HTML is
        // cleaned, then for their data: URIs afterwards. The data URIs are built by us
        // (image/* + base64), and running megabytes of them through the purifier ran
        // out of memory (an email with 13 photos, 2026-11-18).
        $placeholders = [];
        $html = preg_replace_callback('/(["\'])cid:([^"\']+)\1/i', function (array $match) use ($inlineImages, &$placeholders) {
            $uri = $inlineImages[trim($match[2], '<>')] ?? null;
            if (! $uri) {
                return $match[0];
            }
            $key = 'https://inline-image.greenmail.invalid/'.count($placeholders);
            $placeholders[$key] = $uri;

            return $match[1].$key.$match[1];
        }, $html) ?? $html;

        $clean = $this->purifier()->purify($html);

        return $placeholders ? strtr($clean, $placeholders) : $clean;
    }

    private function purifier(): HTMLPurifier
    {
        $config = HTMLPurifier_Config::createDefault();
        $config->set('Cache.SerializerPath', storage_path('framework/cache'));
        $config->set('HTML.Doctype', 'XHTML 1.0 Transitional');
        $config->set('HTML.ForbiddenElements', ['script', 'style', 'form', 'input', 'button', 'iframe', 'object', 'embed', 'base', 'meta', 'link']);
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true, 'tel' => true, 'data' => true]);
        $config->set('CSS.AllowTricky', false);
        $config->set('Attr.AllowedFrameTargets', ['_blank']);
        $config->set('HTML.TargetBlank', true);
        $config->set('HTML.TargetNoopener', true);
        $config->set('HTML.TargetNoreferrer', true);
        $config->set('AutoFormat.RemoveEmpty', false);

        return new HTMLPurifier($config);
    }
}

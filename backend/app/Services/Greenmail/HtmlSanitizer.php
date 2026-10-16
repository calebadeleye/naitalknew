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
        $html = preg_replace_callback('/(["\'])cid:([^"\']+)\1/i', function (array $match) use ($inlineImages) {
            $uri = $inlineImages[trim($match[2], '<>')] ?? null;

            return $uri ? $match[1].$uri.$match[1] : $match[0];
        }, $html) ?? $html;

        return $this->purifier()->purify($html);
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

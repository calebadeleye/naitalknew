<?php

namespace Tests\Unit;

use App\Services\Greenmail\HtmlSanitizer;
use Tests\TestCase;

/** Opening an email with many embedded photos must not run the server out of memory. */
class GreenmailHtmlSanitizerTest extends TestCase
{
    public function test_embedded_images_become_data_uris_and_the_html_is_still_cleaned(): void
    {
        $png = 'data:image/png;base64,'.base64_encode('fake-png-bytes');
        $html = '<p onclick="steal()">Hello</p><script>alert(1)</script><img src="cid:logo1"><img src=\'cid:<logo2>\'><img src="cid:unknown">';

        $clean = app(HtmlSanitizer::class)->clean($html, ['logo1' => $png, 'logo2' => $png]);

        $this->assertSame(2, substr_count($clean, $png));
        $this->assertStringNotContainsString('<script', $clean);
        $this->assertStringNotContainsString('onclick', $clean);
        $this->assertStringNotContainsString('greenmail.invalid', $clean, 'no placeholder left behind');
        $this->assertStringNotContainsString('cid:logo1', $clean);
    }

    public function test_megabytes_of_embedded_images_do_not_go_through_the_purifier(): void
    {
        // Like the email that failed on 2026-11-18: 13 photos, about 4.6 MB.
        $images = [];
        $html = '<p>Invitation</p>';
        for ($i = 0; $i < 13; $i++) {
            $images["img$i"] = 'data:image/png;base64,'.base64_encode(random_bytes(360_000));
            $html .= "<img src=\"cid:img$i\" alt=\"photo $i\">";
        }

        $before = memory_get_usage();
        $clean = app(HtmlSanitizer::class)->clean($html, $images);
        $peakIncrease = memory_get_peak_usage() - $before;

        $this->assertSame(13, substr_count($clean, 'data:image/png;base64,'));
        // The images are ~6.2 MB as text; the result holds them once plus a little.
        $this->assertLessThan(40 * 1024 * 1024, $peakIncrease, 'cleaning should not use many copies of the images');
    }
}

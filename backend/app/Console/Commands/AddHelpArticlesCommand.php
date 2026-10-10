<?php

namespace App\Console\Commands;

use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseGroup;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Fills the knowledge-base gaps the client-area help assistant needs: the
 * hosting tabs (email, databases, SFTP, files, SSL/PHP), domain renewal and
 * receipts had no articles at all, and the support article described a
 * ticket system that doesn't exist.
 *
 * Safe to re-run: an article is only added when its slug is missing, and the
 * support article is only corrected while it still has the original wrong
 * sentence — anything an admin has since edited is left alone.
 */
class AddHelpArticlesCommand extends Command
{
    protected $signature = 'kb:add-help-articles {--dry-run : Show what would change without writing anything}';

    protected $description = 'Add the missing client-area help articles to the knowledge base and correct the support article.';

    private const ARTICLES = [
        [
            'group' => 'Website Management',
            'title' => 'How to Create a Business Email Account',
            'slug' => 'how-to-create-a-business-email-account',
            'summary' => 'Create a professional email address like info@yourbusiness.com from your hosting service.',
            'content' => "Open your hosting service from the Dashboard and go to the Email Accounts tab. Click Create Email Account and enter a username (for example \"info\" — your address becomes info@yourdomain.com), a display name, a quota in MB and a password.\n\nThe new account shows as Pending while it's being set up, then Active. To change an account's name or quota, click Edit; to set a new password, click Change Password.\n\nHow many email accounts you can create depends on your hosting plan — the Email Accounts card at the top of the page shows how many you've used.",
        ],
        [
            'group' => 'Website Management',
            'title' => 'How to Create a Database',
            'slug' => 'how-to-create-a-database',
            'summary' => 'Create a MySQL database for WordPress or any other web application.',
            'content' => "Open your hosting service from the Dashboard and go to the Databases tab. Click Create Database and enter a database name, a username and a password — keep these safe, your application will need them to connect.\n\nThe database shows as Pending while it's being set up, then Active. If you lose the password, click Reset Password to set a new one.\n\nHow many databases you can create depends on your hosting plan — the Databases card at the top of the page shows how many you've used.",
        ],
        [
            'group' => 'Website Management',
            'title' => 'How to Create an SSH/SFTP Account',
            'slug' => 'how-to-create-an-ssh-sftp-account',
            'summary' => 'Create a secure login for uploading files with an SFTP program.',
            'content' => "Open your hosting service from the Dashboard and go to the SSH/SFTP tab. Click Create Account and choose a username and password.\n\nOnce the account is Active, connect with an SFTP program such as FileZilla using the host shown on the SSH/SFTP tab, together with your new username and password.\n\nSSH/SFTP access depends on your hosting plan. If your plan doesn't include it, you can still manage files from the Files tab.",
        ],
        [
            'group' => 'Website Management',
            'title' => 'How to Use the File Manager',
            'slug' => 'how-to-use-the-file-manager',
            'summary' => "Browse, upload and unzip your website's files without any extra software.",
            'content' => "Open your hosting service from the Dashboard — the Files tab opens first. From there you can browse your website's folders, create a new folder, upload a file with Upload File, and unzip a .zip file you've uploaded by clicking Unzip next to it. Click Refresh to see the latest changes.\n\nThe first time you open it, the file manager takes about a minute to set up. If it says it's still being set up, try again shortly.",
        ],
        [
            'group' => 'Website Management',
            'title' => 'How to Set Up SSL and PHP for Your Website',
            'slug' => 'how-to-set-up-ssl-and-php',
            'summary' => 'Turn on HTTPS with a free SSL certificate or your own, and switch PHP on or off.',
            'content' => "Open your hosting service from the Dashboard and go to the Website tab.\n\nSSL: click Activate Free SSL to secure your website with HTTPS. It can take a few minutes to become active, and your domain must already point to your NAI TALK hosting. If you have your own certificate, paste the certificate, private key and (optionally) CA bundle under \"Or install your own SSL certificate\" and click Install Certificate. Turn Off SSL removes it.\n\nPHP: use Turn On or Turn Off. PHP must be on to run WordPress or any other PHP application.\n\nReverse Proxy (Advanced) forwards your website to an application running on a port you specify — only use it if your developer asks you to.",
        ],
        [
            'group' => 'Domains & DNS',
            'title' => 'How to Renew a Domain',
            'slug' => 'how-to-renew-a-domain',
            'summary' => 'Renew a domain you registered with NAI TALK, and switch auto-renewal on or off.',
            'content' => "Open My Domains and choose the domain. You'll see its expiry date, renewal history and whether auto-renewal is on.\n\nClick Renew to create a renewal invoice for one year at that domain's renewal price, then pay it by card, bank transfer or your NAI TALK wallet. The new expiry date shows once your payment is confirmed and the renewal has been processed.\n\nUse Enable Auto-Renew or Disable Auto-Renew on the same page to choose whether the domain renews automatically. Auto-renewal pays from your wallet or a saved card you've marked for auto-renewal, so keep one of them ready.\n\nIf your domain is with another provider, renew it there — or transfer it to NAI TALK.",
        ],
        [
            'group' => 'Orders & Invoices',
            'title' => 'How to Download Your Receipt',
            'slug' => 'how-to-download-your-receipt',
            'summary' => 'Get a PDF receipt for any invoice you have paid, including part payments.',
            'content' => "Open Orders & Invoices and choose the invoice. As soon as any payment has been received for it, a Download Receipt button appears next to Download Invoice.\n\nThe receipt lists every payment made against the invoice — date, payment method, reference and amount — together with the invoice total and any outstanding balance. Part payments get a receipt too.",
        ],
    ];

    private const SUPPORT_SLUG = 'how-to-raise-a-support-ticket';

    /** The sentence in the original article describing a ticket system that doesn't exist. */
    private const SUPPORT_WRONG_TEXT = 'opening a support ticket from your dashboard';

    private const SUPPORT_TITLE = 'How to Get Help and Support';

    private const SUPPORT_CONTENT = "Click Help & Support in the client area menu (or the Need help? button) to ask the help assistant how to do something — it answers from these help guides and links you to the right one.\n\nFor anything it can't answer, or anything about your own account, message the NAI TALK team on WhatsApp: use \"Chat with our team on WhatsApp\" in the help assistant, or the WhatsApp button on our website. Include your domain or service name so we can look into it faster. Priority support is included on Business and Premium Website Care plans.";

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $rows = [];

        foreach (self::ARTICLES as $definition) {
            if (KnowledgeBaseArticle::query()->where('slug', $definition['slug'])->exists()) {
                $rows[] = [$definition['title'], 'already exists — left unchanged'];

                continue;
            }

            if (! $dryRun) {
                $group = KnowledgeBaseGroup::query()->firstOrCreate(
                    ['name' => $definition['group']],
                    ['slug' => Str::slug($definition['group']), 'sort_order' => (int) KnowledgeBaseGroup::query()->max('sort_order') + 1],
                );

                KnowledgeBaseArticle::query()->create([
                    'group_id' => $group->id,
                    'title' => $definition['title'],
                    'slug' => $definition['slug'],
                    'summary' => $definition['summary'],
                    'content' => $definition['content'],
                    'sort_order' => (int) KnowledgeBaseArticle::query()->where('group_id', $group->id)->max('sort_order') + 1,
                    'status' => 'published',
                    'last_updated_at' => now(),
                ]);
            }

            $rows[] = [$definition['title'], $dryRun ? 'would be added' : 'added'];
        }

        $support = KnowledgeBaseArticle::query()->where('slug', self::SUPPORT_SLUG)->first();

        if ($support && str_contains((string) $support->content, self::SUPPORT_WRONG_TEXT)) {
            if (! $dryRun) {
                $support->forceFill([
                    'title' => self::SUPPORT_TITLE,
                    'content' => self::SUPPORT_CONTENT,
                    'last_updated_at' => now(),
                ])->save();
            }

            $rows[] = [self::SUPPORT_TITLE, $dryRun ? 'support article would be corrected' : 'support article corrected'];
        } else {
            $rows[] = ['Support article', $support ? 'already corrected or edited — left unchanged' : 'not found — left unchanged'];
        }

        $this->table(['Article', 'Result'], $rows);

        if ($dryRun) {
            $this->comment('Dry run — nothing was written.');
        }

        return self::SUCCESS;
    }
}

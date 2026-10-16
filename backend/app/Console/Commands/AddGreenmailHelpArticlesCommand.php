<?php

namespace App\Console\Commands;

use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseGroup;
use Illuminate\Console\Command;

/**
 * Adds the "Email & Green Mail" knowledge-base guides: signing in, checking
 * (picking up) mail, sending, replying/forwarding, filters and vacation
 * replies, and setting the mailbox up in a phone or desktop mail app. The
 * public /green-mail page links to these slugs.
 *
 * Safe to re-run: an article is only added when its slug is missing, so an
 * admin's later edits are kept. "## " starts a section heading and "- " a
 * bullet (see articleBlocks() in KnowledgeBasePages.tsx).
 */
class AddGreenmailHelpArticlesCommand extends Command
{
    protected $signature = 'kb:add-greenmail-articles {--dry-run : Show what would change without writing anything}';

    protected $description = 'Add the Email & Green Mail guides to the knowledge base.';

    private const GROUP = ['name' => 'Email & Green Mail', 'slug' => 'email-green-mail', 'icon' => 'Mail'];

    private const ARTICLES = [
        [
            'title' => 'How to Sign In to Green Mail',
            'slug' => 'how-to-sign-in-to-green-mail',
            'summary' => 'Open Green Mail, the free webmail included with your NAI TALK hosting, and sign in to your business mailbox.',
            'content' => "Green Mail is the webmail that comes free with every NAI TALK hosting plan. You can use it on any computer, tablet or phone with a web browser.\n\n## Open Green Mail\n- In your browser, go to your own website followed by /greenmail, for example yourbusiness.com/greenmail.\n- Or, in the NAI TALK client area, open your hosting service, go to the Email Accounts tab and click Open mail next to the mailbox.\n\n## Sign in\n- Enter your full email address (for example info@yourbusiness.com) and that mailbox's password.\n- Tick Keep me signed in only on a device you don't share with anyone.\n- Click Sign in.\n\n## Forgot the password?\nThe owner of the hosting account can set a new one: in the client area, open the hosting service, go to Email Accounts and click Change Password next to the mailbox.\n\n## Install Green Mail as an app\n- On Android, Windows or Mac (Chrome or Edge): click Install Green Mail on this device on the sign-in page, or Install app at the top once you're signed in.\n- On iPhone or iPad (Safari): tap the Share button, then Add to Home Screen.\nThe installed app opens straight to your own website's sign-in page.\n\n## Sign out\nClick the sign-out icon at the top right. Always sign out on a shared or public computer.",
        ],
        [
            'title' => 'How to Check (Pick Up) Your Emails in Green Mail',
            'slug' => 'how-to-check-your-emails-in-green-mail',
            'summary' => 'Find new mail, open messages and attachments, search, and keep your inbox tidy.',
            'content' => "Once you're signed in, Green Mail opens your Inbox. Unread emails are shown in bold, and the number next to Inbox is how many you haven't read.\n\n## New emails arrive by themselves\nYou don't need to reload the page. Green Mail checks for new mail every 30 seconds and whenever you come back to the tab. When something new arrives, a message pops up at the top, for example \"New email from Ada: Invoice\". Click Open to read it.\n\n## Read an email\n- Click any email in the list to open it on the right (on a phone it fills the screen; tap the back arrow to return).\n- Attachments are listed under the message. Click one to download it.\n- Pictures from the internet are hidden until you click Show images. This stops senders from secretly tracking when you open their email.\n\n## Find an email\n- Type in the search box at the top and press Enter.\n- Use the All, Unread, Flagged and Attachments tabs above the list to narrow it down.\n- Starred shows every email you've starred.\n\n## Folders\n- Inbox: new mail.\n- Sent: everything you've sent.\n- Drafts: emails you saved to finish later.\n- Spam: suspected junk. Check it now and then in case something real lands there; open it and click Not spam to move it back.\n- Trash: deleted emails. Empty Trash removes them for good.\n\n## Tidy up\nTick the boxes next to several emails to delete, archive, mark as read or unread, or move them to Spam in one go. Green Mail always asks before deleting.\n\n## Not seeing an email you expect?\n- Check the Spam folder.\n- Make sure the sender has your exact address.\n- If your mailbox storage is full (see Storage at the bottom left), new mail can't arrive. Empty Trash and Spam, or ask for a bigger quota.",
        ],
        [
            'title' => 'How to Send an Email in Green Mail',
            'slug' => 'how-to-send-an-email-in-green-mail',
            'summary' => 'Write a new email, add Cc or Bcc, attach files, use a template or schedule it for later.',
            'content' => "## Write a new email\n- Click Compose (on a phone, tap the green + button).\n- In To, type the address. People you've emailed before are suggested as you type. Separate several addresses with commas.\n- To copy someone in, click the person-plus icon at the end of the To line and choose Add Cc or Add Bcc. People in Bcc receive the email without the others seeing their address.\n- Type a subject and your message. The toolbar has bold, italic, underline, lists, quotes and links.\n- Click Send. A message at the top confirms it has been sent, and a copy is saved in Sent.\n\n## Attach files\nClick the paperclip next to Send and choose your files. You can attach up to 10 files, each up to 20 MB. To remove one, click the × next to its name.\n\n## Use a template\nClick Templates above the message and pick one; it fills in the subject and message. To keep the email you've written for next time, choose Save this message as a template. Manage your templates under Tools > Templates.\n\n## Send it later\nClick the small arrow next to Send and choose Tomorrow morning, Monday morning, or pick your own date and time. Scheduled emails are listed under Tools > Automation, where you can cancel them before they go out.\n\n## Save a draft\nClick Save draft to finish it later. Drafts are kept in the Drafts folder; open one to carry on writing.\n\n## Add a signature\nClick the gear icon (Settings) at the top right. Add your display name and a signature, including a logo or picture if you like. It's added to new emails, replies and forwards automatically.",
        ],
        [
            'title' => 'How to Reply to and Forward Emails',
            'slug' => 'how-to-reply-to-and-forward-emails',
            'summary' => 'Reply to the sender or everyone, forward with the original attachments, and let the AI assistant draft a reply.',
            'content' => "Open the email, then use the buttons at the top of the message.\n\n## Reply\n- Reply answers only the sender. Reply all also includes everyone else who received it.\n- The reply box opens below the message with the cursor ready where you type, marked \"Type your reply here…\". Your signature is added underneath.\n- The original message is included under your reply automatically when it's sent.\n- To change who it goes to, click Edit next to \"Replying to\".\n\n## Forward\n- Click Forward and type the address of the person you're sending it to.\n- The original attachments are sent along. Click the × next to any you don't want to include.\n\n## Let the AI assistant help\nClick AI Assistant at the top right while an email is open. You can summarise the email, draft a professional reply, pull out the action items, translate it to Yoruba, or ask your own question about it. When it drafts a reply, click Use this reply to put it in the reply box, then check and edit it before you send.",
        ],
        [
            'title' => 'How to Set Up Email Filters and a Vacation Reply',
            'slug' => 'how-to-set-up-email-filters-and-a-vacation-reply',
            'summary' => 'Sort incoming mail automatically, reply when you\'re away, and forward copies to a colleague.',
            'content' => "Filters and automatic replies run on the NAI TALK mail server, so they keep working when Green Mail is closed and apply to your phone's mail app too. Changes take effect for new mail within about a minute.\n\n## Create a filter\n- Go to Tools > Filters and click Add a filter.\n- Choose what to look at (From, To / Cc, Subject, or Every email), how to match it (contains, is exactly, begins with, ends with) and the text, for example From contains paystack.com.\n- Choose what happens: Move to folder, Mark as read, Star it, or Delete it.\n- Click Save rule. Use the switch next to a rule to pause it, or the bin to delete it.\n\n## Turn on a vacation reply\n- Go to Tools > Automation.\n- Under Vacation reply, write a subject and message, and optionally choose From and Until dates.\n- Click Turn on. Each person who writes to you gets the reply at most once a day, and spam is never answered.\n- Turn it off again with the switch, or it stops by itself after the Until date.\n\n## Reply automatically to certain emails\nUnder Tools > Automation, click Add an automation, choose a condition (for example Subject contains quote) and Reply automatically, then write the reply or start from a template. While your vacation reply is on, it replies instead, so nobody gets two answers.\n\n## Forward a copy to someone else\nAdd an automation with Forward a copy to, and enter the address. You keep your copy too.",
        ],
        [
            'title' => 'How to Set Up Your Email on Your Phone or Outlook',
            'slug' => 'how-to-set-up-your-email-on-your-phone-or-outlook',
            'summary' => 'Use your business mailbox in Outlook, Apple Mail, Gmail or your phone\'s mail app, alongside Green Mail.',
            'content' => "You can read and send your business email in any mail app as well as in Green Mail. They use the same mailbox, so what you read, send, move or delete shows the same everywhere.\n\n## Settings to enter\n- Email address and username: your full email address, for example info@yourbusiness.com.\n- Password: the mailbox password.\n- Incoming mail (IMAP, recommended): server mail.naitalk.com, port 993, security SSL/TLS.\n- Incoming mail (POP3, only if your app needs it): server mail.naitalk.com, port 995, security SSL/TLS.\n- Outgoing mail (SMTP): server mail.naitalk.com, port 465 with SSL/TLS, or port 587 with STARTTLS.\n- Outgoing server requires sign-in: yes, with the same username and password.\n\n## On an iPhone or iPad\nGo to Settings > Mail > Accounts > Add Account > Other > Add Mail Account. Enter your name, email address and password, choose IMAP, and enter the servers above for both incoming and outgoing mail.\n\n## On Android (Gmail app)\nOpen Gmail, tap your profile picture > Add another account > Other. Enter your email address, choose Personal (IMAP), enter your password, then the incoming and outgoing servers above.\n\n## In Outlook\nGo to File > Add Account, enter your email address, open Advanced options and tick Let me set up my account manually. Choose IMAP and enter the servers above.\n\n## Prefer not to set anything up?\nOpen yourbusiness.com/greenmail in your phone's browser and install Green Mail as an app. There's nothing to configure.",
        ],
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $rows = [];

        $group = KnowledgeBaseGroup::query()->where('slug', self::GROUP['slug'])->first();
        if (! $group && ! $dryRun) {
            $group = KnowledgeBaseGroup::query()->create(self::GROUP + ['sort_order' => (int) KnowledgeBaseGroup::query()->max('sort_order') + 1]);
        }

        foreach (self::ARTICLES as $definition) {
            if (KnowledgeBaseArticle::query()->where('slug', $definition['slug'])->exists()) {
                $rows[] = [$definition['title'], 'already exists — left unchanged'];

                continue;
            }

            if (! $dryRun) {
                KnowledgeBaseArticle::query()->create($definition + [
                    'group_id' => $group->id,
                    'sort_order' => (int) KnowledgeBaseArticle::query()->where('group_id', $group->id)->max('sort_order') + 1,
                    'status' => 'published',
                    'last_updated_at' => now(),
                ]);
            }

            $rows[] = [$definition['title'], $dryRun ? 'would be added' : 'added'];
        }

        $this->table(['Article', 'Result'], $rows);

        if ($dryRun) {
            $this->comment('Dry run — nothing was written.');
        }

        return self::SUCCESS;
    }
}

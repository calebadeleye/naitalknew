<?php

namespace App\Services\HelpAssistant;

use App\Models\Client;
use App\Models\HelpAssistantQuestion;
use App\Models\KnowledgeBaseArticle;
use App\Services\NaiGrowth\GeminiClient;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Throwable;

/**
 * The floating "How do I…?" assistant in the client area. It answers only
 * from the published knowledge base plus a fixed map of the client area — it
 * cannot see or change anyone's account — and every question is logged with
 * whether the knowledge base covered it, so unanswered questions show which
 * articles are missing.
 *
 * When the AI model is unavailable (no key, outage, timeout) it falls back to
 * a plain keyword search over the same articles rather than failing.
 */
class ClientHelpAssistant
{
    /** Where everything is in the client area — kept in step with portalNavLinks and the hosting tabs in ClientPortal.tsx. */
    private const CLIENT_AREA_MAP = <<<'MAP'
- Dashboard: overview of your services, domains, recent orders and invoices. Open a hosting service from "Your Services" to manage it.
- Services Catalog: order hosting, Website Care Plans, business email and other services.
- Orders & Invoices: your orders and their invoices. Open an invoice to pay it (card, bank transfer or wallet), upload bank-transfer proof, "Download Invoice", and — once anything is paid — "Download Receipt".
- My Domains: your domains. Open a domain to Renew it, Enable/Disable Auto-Renew, see its expiry date, nameservers and renewal history, and edit its domain contact details.
- Search Domains: check availability and register a new domain. Domain transfer is started from the domains area ("Transfer a Domain to NAI TALK", needs the EPP code).
- Wallet: your balance, "Fund Wallet", and paying invoices from your wallet.
- Saved Payment Methods: saved cards, and choosing a card for auto-renewal.
- My Profile: personal and company details, billing details, Change Password, and email preferences (invoice alerts, renewal reminders, product updates).
- Help & Support: opens this help assistant. For anything it can't answer, the "Chat with our team on WhatsApp" link at the bottom of the chat reaches the NAI TALK team.
- Managing a hosting service (open it from the Dashboard): usage cards at the top show disk usage, bandwidth and how many email accounts, databases and FTP accounts you've used against your plan, and a Hosting Summary panel shows the plan details. Below them are these tabs:
  - Files: the file manager — browse, upload and unzip your website's files.
  - Email Accounts: create, edit and delete business email accounts (mailboxes).
  - Databases: create MySQL databases and reset their passwords.
  - SSH/SFTP: create SSH/SFTP accounts for uploading files.
  - Website: turn PHP on or off, set up SSL (a free certificate or your own) and an optional reverse proxy.
  - Software: one-click installs of supported apps.
MAP;

    public function __construct(private readonly GeminiClient $gemini) {}

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array{reply: string, articles: array<int, array{title: string, slug: string}>, answered: bool, used_fallback: bool}
     */
    public function answer(?Client $client, string $question, array $history = []): array
    {
        $articles = KnowledgeBaseArticle::query()
            ->published()
            ->with('group')
            ->orderBy('sort_order')
            ->get();

        try {
            $result = $this->askModel($articles, $question, $history);
        } catch (Throwable) {
            $result = $this->keywordFallback($articles, $question);
        }

        HelpAssistantQuestion::query()->create([
            'client_id' => $client?->id,
            'question' => Str::limit($question, 2000, ''),
            'answered_from_knowledge_base' => $result['answered'],
            'article_slugs' => array_column($result['articles'], 'slug'),
            'used_fallback' => $result['used_fallback'],
        ]);

        return $result;
    }

    /**
     * @param  Collection<int, KnowledgeBaseArticle>  $articles
     * @param  array<int, array{role: string, content: string}>  $history
     */
    private function askModel(Collection $articles, string $question, array $history): array
    {
        $knowledgeBase = $articles
            ->map(fn (KnowledgeBaseArticle $article) => "### {$article->title} (slug: {$article->slug}; section: ".($article->group?->name ?? 'General').")\n".trim(strip_tags((string) $article->content)))
            ->implode("\n\n");

        $clientAreaMap = self::CLIENT_AREA_MAP;

        $systemPrompt = <<<PROMPT
You are the help assistant inside the NAI TALK client area. NAI TALK is a Nigerian company providing domains, web hosting, Website Care Plans, business email and website design. Signed-in clients ask you how to find their way around and how to do things.

Answer ONLY from the KNOWLEDGE BASE and the CLIENT AREA MAP below.
- Be brief and practical: two to five sentences, or short numbered steps that name the exact menu items and buttons from the map.
- If neither source covers the question, say plainly that you don't have a guide for that yet and suggest contacting the team using the "Chat with our team on WhatsApp" link below this chat. Never guess, and never invent features, prices, timelines or policies.
- You cannot see or change the client's account, services or payments. Don't claim to, and don't ask for passwords, card numbers or one-time codes.
- Reply in plain text, without Markdown headings or tables.

Finish every reply with exactly these two lines:
ARTICLES: <comma-separated slugs of the knowledge base articles you used, or none>
ANSWERED: <yes if the knowledge base or map answered the question, otherwise no>

CLIENT AREA MAP
{$clientAreaMap}

KNOWLEDGE BASE
{$knowledgeBase}
PROMPT;

        $raw = $this->gemini->generateReply($systemPrompt, $history, $question)['reply'];

        return $this->parseModelReply($raw, $articles);
    }

    /** @param  Collection<int, KnowledgeBaseArticle>  $articles */
    private function parseModelReply(string $raw, Collection $articles): array
    {
        $slugs = [];
        $answered = false;

        if (preg_match('/^\s*ARTICLES:\s*(.*)$/mi', $raw, $match)) {
            $slugs = array_values(array_filter(array_map('trim', explode(',', strtolower($match[1]))), fn ($slug) => $slug !== '' && $slug !== 'none'));
        }

        if (preg_match('/^\s*ANSWERED:\s*(yes|no)\b/mi', $raw, $match)) {
            $answered = strtolower($match[1]) === 'yes';
        }

        $reply = trim(preg_replace('/^\s*(ARTICLES|ANSWERED):.*$/mi', '', $raw));

        // Only ever link to articles that really exist and are published.
        $cited = $articles->filter(fn (KnowledgeBaseArticle $article) => in_array($article->slug, $slugs, true));

        return [
            'reply' => $reply,
            'articles' => $this->presentArticles($cited),
            'answered' => $answered,
            'used_fallback' => false,
        ];
    }

    /** @param  Collection<int, KnowledgeBaseArticle>  $articles */
    private function keywordFallback(Collection $articles, string $question): array
    {
        $stopWords = ['how', 'can', 'the', 'and', 'for', 'what', 'where', 'when', 'why', 'who', 'does', 'did', 'are', 'you', 'your', 'with', 'from', 'this', 'that', 'into', 'about', 'have', 'has', 'want', 'need', 'please', 'naitalk'];
        $terms = collect(preg_split('/[^a-z0-9]+/', strtolower($question)))
            ->filter(fn ($term) => strlen($term) > 2 && ! in_array($term, $stopWords, true))
            ->unique();

        $ranked = $articles
            ->map(function (KnowledgeBaseArticle $article) use ($terms) {
                $title = strtolower($article->title);
                $summary = strtolower((string) $article->summary);
                $content = strtolower(strip_tags((string) $article->content));
                $score = $terms->sum(fn ($term) => 3 * substr_count($title, $term) + 2 * substr_count($summary, $term) + min(substr_count($content, $term), 3));

                return ['article' => $article, 'score' => $score];
            })
            ->filter(fn (array $row) => $row['score'] > 0)
            ->sortByDesc('score')
            ->take(3)
            ->pluck('article');

        $reply = $ranked->isNotEmpty()
            ? "I can't give a full answer just now, but these guides look like the right place to start:"
            : "I couldn't find a guide for that. Please message the NAI TALK team using the “Chat with our team on WhatsApp” link below, and they'll help you.";

        return [
            'reply' => $reply,
            'articles' => $this->presentArticles($ranked),
            'answered' => $ranked->isNotEmpty(),
            'used_fallback' => true,
        ];
    }

    /**
     * @param  Collection<int, KnowledgeBaseArticle>  $articles
     * @return array<int, array{title: string, slug: string}>
     */
    private function presentArticles(Collection $articles): array
    {
        return $articles
            ->map(fn (KnowledgeBaseArticle $article) => ['title' => $article->title, 'slug' => $article->slug])
            ->values()
            ->all();
    }
}

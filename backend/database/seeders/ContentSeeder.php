<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\Faq;
use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseGroup;
use App\Models\ServiceStatus;
use App\Services\Media\PexelsImageService;
use Illuminate\Database\Seeder;

class ContentSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedBlogPosts();
        $this->seedKnowledgeBase();
        $this->seedFaqs();
        $this->seedServiceStatuses();
    }

    private function seedBlogPosts(): void
    {
        $pexels = app(PexelsImageService::class);

        $posts = [
            [
                'title' => 'How to Choose the Perfect Domain Name for Your Nigerian Business',
                'excerpt' => 'Your domain name is often a customer\'s first impression of your business. Here\'s how to pick one that builds trust and is easy to remember.',
                'image_query' => 'domain name website',
                'content' => "Let me tell you what happened at my cousin's business naming meeting.\n\nShe gathered the family to help her pick a name for her new clothing line. Uncle Emeka said the name must contain the word “Global,” because according to him, “every serious business today is global.” Aunty Ngozi disagreed and insisted on adding “Ventures,” because in her words, “Ventures gives it weight.” Her younger brother, fresh from a two-week trip to Canada, suggested a name mixing English and French that nobody in the room could pronounce the same way twice.\n\nBy the time the meeting ended, there were seven suggested names, three of them contradicted each other, one had a spelling nobody agreed on, and somebody was already offended.\n\nThis, my friend, is exactly what happens to many Nigerian business owners the day they sit down to choose a domain name.\n\n## Why Your Domain Name Matters More Than You Think\n\nYour domain name is not just a technical detail you fill in during registration. It is your business address online.\n\nBefore a customer sees your logo, reads your prices, or scrolls your services, they see your domain name first. It is the first handshake, the first impression, the first “Hmm, this one looks serious” or “Hmm, is this one even real?”\n\nA good domain name builds trust before your website even finishes loading. A confusing one quietly chases customers away, and they will not send you a text to explain why.\n\n## Start With Your Business Name, Not a Committee\n\nUnlike the naming meeting story above, choosing a domain name does not need seven contributors and one uncle with strong opinions about the word “Global.”\n\nIf “yourbusiness.com” is available, take it. Do not overthink it. It is what people already remember, what they will type from habit, and what they expect to see on your invoice, your business card, and your email signature.\n\nIf your exact name is taken, resist the temptation to patch it with random numbers or hyphens. “yourbusiness247.com” or “yourbusiness-ng.com” looks like a placeholder, not a business. A short, clear variation, such as adding a one-word descriptor or “ng,” reads far better.\n\n## Keep It Short Enough to Say Out Loud\n\nHere is a small test: say your domain name out loud, the way you would read it to someone over the phone, or announce it on a radio advert.\n\nIf it takes you three tries, or the other person keeps asking “sorry, how do you spell that again,” it is already too complicated.\n\nAvoid anything that can be misheard, misspelled, or auto-corrected into something else entirely. Steer clear of hyphens and numbers wherever you can. Your domain name should survive a noisy phone call in traffic and still make sense on the other end.\n\n## Choose the Right Extension for Your Audience\n\nOnce the name itself is settled, the next decision is the extension: .com, .com.ng, or .ng.\n\nA local extension like .com.ng signals “Nigerian business” clearly and can be easier to secure than the equivalent .com. A .com still reads as the safe, universal default, especially if you plan to serve customers outside Nigeria. We break down the full difference, extension by extension, in our next article, so you are not left guessing.\n\n## Register It the Same Day\n\nGood domain names do not stay available for long. Once you have picked one that passes the say-it-out-loud test, search it and register it immediately, before another business owner in a similar naming meeting beats you to it.\n\nNAI TALK's domain search shows you instantly whether your chosen name is free, so you can move from “maybe” to “registered” in minutes, not another family meeting.\n\n## Final Thought\n\nYour domain name is the one decision every other part of your online presence depends on: your website, your business email, your invoices, your adverts.\n\nPick something simple, memorable, and easy to say out loud, register it quickly, and let the naming committee argue about something else next time.\n\nReady to find your domain name? Search available domain names on NAI TALK and register the one that fits your Nigerian business, before someone else does.",
            ],
            [
                'title' => '.com vs .com.ng vs .ng: Which Domain Should Your Business Use?',
                'excerpt' => 'Confused about which domain extension fits your business? Here\'s a simple, practical breakdown of .com, .com.ng, and .ng.',
                'image_query' => 'online business internet',
                'content' => "A friend called me last week, panicking.\n\n“Bros, should I buy .com or .com.ng? My guy at the shop said .ng is for tech people only. My wife said .com.ng looks more Nigerian. My last customer said just buy all of them.”\n\nI could hear the stress in his voice, the same stress every Nigerian business owner feels when three different people give three different confident answers, and somehow all three sound correct at the same time.\n\nThis is one of the most common questions we get from business owners, so let us settle it once and for all, with no shouting.\n\n## The Real Difference Between .com, .com.ng, and .ng\n\nBefore we compare, understand this: none of these domain extensions is “fake” or “less serious.” Each one simply signals something different to whoever visits your website.\n\n### .com: The World's Default\n\n.com is the world's default. If you plan to sell to customers outside Nigeria, or you simply want the most universally recognised address, .com is the safe choice. Almost every customer, whether in Lagos or London, will type “.com” out of habit if they are not sure of your exact address.\n\n### .com.ng: Clearly Nigerian, Often Easier to Get\n\n.com.ng signals a Nigerian business clearly and is often easier to secure than the equivalent .com, since fewer businesses have claimed it yet. It works well for local service businesses, schools, churches, and shops that mainly serve Nigerian customers who already trust anything that looks distinctly home-grown.\n\n### .ng: Short, Modern, and Increasingly Premium\n\n.ng is shorter and increasingly seen as a premium, modern choice for Nigerian brands — similar to how .io became popular with tech startups globally. It is a strong option if you want something distinctive, short, and memorable, especially for a tech product or a bold new brand.\n\n## So Which Domain Extension Should You Actually Choose?\n\nHere is the honest answer, no confident guessing required: match your extension to where most of your customers are.\n\nIf you are targeting a global audience, or plan to expand outside Nigeria eventually, go with .com. If your customers are mostly Nigerian and you want your business to read as clearly local and trustworthy, .com.ng or .ng both work well.\n\n## Can You Just Buy All Three?\n\nIf your budget allows, yes, and it is often a smart move. Securing your business name across more than one extension protects your brand from copycats and lets you redirect the extra domains straight to your main site. Nobody wants to build a strong brand on .com only to find someone else selling similar products on the .com.ng version of your name.\n\nBut if you are choosing just one today, do not let three different opinions confuse you. Pick the extension that matches your audience, register it, and move on to building the actual business.\n\n## Final Thought\n\n.com, .com.ng, and .ng are not rivals fighting for your soul. They are simply three doors that lead to the same house, each one signalling something slightly different to the person standing outside.\n\nWhichever door you choose, NAI TALK can register it in minutes and manage your renewals for you, so you never lose your domain name to a forgotten renewal date, or to someone else's confident but wrong advice.\n\nReady to pick yours? Search your domain name on NAI TALK today and see instantly which extensions are available.",
            ],
            [
                'title' => 'How Much Does Domain Registration Cost in Nigeria?',
                'excerpt' => 'A clear, no-surprises look at what you should expect to pay for a domain name in Nigeria — and what affects the price.',
                'image_query' => 'small business owner laptop',
                'content' => "Have you ever sent someone to buy tomatoes in the market, and three different sellers give you three completely different prices for the same size of basket?\n\nOne woman looks at you and says ₦3,000. Another one, same tomatoes, same size, says ₦4,500 “because fuel don cost.” A third one just quotes ₦6,000 and refuses to move, standing behind her table like she is guarding the Central Bank vault.\n\nMany business owners expect domain registration cost in Nigeria to work the same way, three different prices, three different stories, and a lot of confusion about what they are actually paying for. Thankfully, it does not have to be like that.\n\n## What You're Really Paying For\n\nWhen you register a domain name, you are not just buying a name. You are paying for a one-year, or multi-year, reservation of that exact address, plus the infrastructure that keeps it pointed at your website and your business email without interruption.\n\nThink of it as renting a plot of land with your name boldly written on the fence, except the “landlord” is an international or local domain registry, and the rent is due once a year.\n\n## Why Domain Prices Differ by Extension\n\nDomain pricing in Nigeria varies mainly by extension, and there is a real reason behind it, not market-woman logic.\n\nGlobal extensions like .com and .net are priced by the international registries that manage them, so the cost is broadly similar everywhere in the world, simply converted to naira. Local extensions like .com.ng and .ng are managed differently, closer to home, and can be priced differently as a result.\n\n## What About Renewal Prices?\n\nHere is where some registrars quietly disappoint people. They offer a shockingly low price in year one, then hit you with a much higher renewal price in year two, once you are already attached to the domain and your business cards are printed.\n\nA reputable registrar will never surprise you with a huge price jump at renewal time. Renewal pricing should be broadly similar to registration pricing, not a trap waiting for year two.\n\n## The Hidden Costs Beyond the Domain Itself\n\nA domain name alone does not run a business online. Beyond the domain, most businesses also need hosting, to actually store the website, and a professional business email address, which is usually a separate, small monthly or yearly cost.\n\nThese extra costs are often the ones business owners forget to budget for, only to be surprised later, the same way “small” transport fare always adds up by the end of the month.\n\nThat is exactly why we bundle domain, hosting, and business email together in our Website Care Plans, so there is one predictable bill instead of several scattered ones arriving at different times.\n\n## No Haggling Required\n\nUnlike the tomato seller standing guard over her table, you should never have to haggle, guess, or beg for a fair domain price. You should be able to see the price, understand what it covers, and pay it with confidence.\n\n## Final Thought\n\nDomain registration cost in Nigeria does not need to feel like market bargaining. A clear registrar shows you the registration price, the renewal price, and exactly what is included, no surprises, no “fuel don cost” explanations.\n\nYou can see NAI TALK's current, transparent domain pricing — registration, renewal, and transfer — on our Domain Pricing page, with no hidden fees added at checkout.\n\nReady to register your domain name? Check our transparent domain pricing today, no haggling necessary.",
            ],
            [
                'title' => 'What Is Web Hosting and Why Does Your Website Need It?',
                'excerpt' => 'If a domain is your address, hosting is the building behind it. Here\'s a simple explanation for non-technical business owners.',
                'image_query' => 'web hosting server',
                'content' => "Let me tell you a short story.\n\nImagine you spent good money to sew a fine agbada. Not just any agbada. I mean the kind of agbada that enters a room before you do. The embroidery is shining, the cap is sitting well, and even your enemies will have no choice but to say, “Hmm, this one is clean.”\n\nThen on the day of the big event, you wear the agbada, spray perfume, look in the mirror, smile with confidence, and step outside.\n\nBut there is one small problem.\n\nYou forgot to book the event hall.\n\nSo you are standing on the road in your fine agbada, looking powerful, but there is no place to enter.\n\nThat is exactly what happens when you build a website without hosting.\n\nYour website may look beautiful. Your logo may be sharp. Your pictures may be clean. Your business may even be ready to collect customers' money. But without web hosting, your website has no home on the internet.\n\nIt is like having a shop signboard but no shop.\n\n## So, What Is Web Hosting?\n\nWeb hosting is the online space where your website lives.\n\nWhen someone types your website address, for example, www.yourbusiness.com, their phone or laptop needs to fetch your website files from somewhere. That “somewhere” is your web hosting server.\n\nYour website is made up of files, images, text, code, forms, emails, databases, and other important things. Web hosting stores those things and makes them available whenever people visit your website.\n\nIn simple terms: domain name is your address, web hosting is the house, and your website is what people see when they enter.\n\nSo if your domain name is like mybusiness.com, your hosting is the land or building where the actual website stays.\n\n## Why Does Your Website Need Hosting?\n\nBecause without hosting, your website cannot be properly available online. A website needs hosting for five major reasons.\n\n### 1. Hosting Keeps Your Website Online\n\nYour customers can visit your website at any time: morning, afternoon, midnight, during traffic, inside church compound, at work, or while pretending to be busy.\n\nA good hosting service keeps your website available whenever people need it.\n\nIf your hosting is poor, your website can go offline often. And when customers visit and see an error page, many of them will not come back. They will not call you to ask what happened. They will just assume your business is not serious and move to another person.\n\nThat is why reliable web hosting is important for every business website.\n\n### 2. Hosting Affects Your Website Speed\n\nHave you ever opened a website and waited so long that you started questioning your life decisions?\n\nYou tap the link. Nothing. You wait. Still loading. You check your data. You refresh.\n\nAt that point, even if the business is selling gold for ₦500, you may leave.\n\nThat is what slow hosting can do to a website.\n\nGood web hosting helps your website load faster. And speed matters because people are impatient online. If your website is slow, visitors may leave before they even see your products, services, or contact information.\n\nFor small businesses in Nigeria, speed is very important because many users are browsing with mobile data. Your website must load quickly and smoothly.\n\n### 3. Hosting Helps Protect Your Website\n\nA website is not just a digital flyer. It is part of your business.\n\nYour hosting should help protect your website with things like SSL security, backups, server monitoring, basic security checks, and recovery support.\n\nSSL is what gives your website the security lock in the browser. It helps users trust your site, especially when they are submitting forms, making payments, or contacting your business.\n\nWithout proper hosting and security, your website can become vulnerable to attacks, malware, broken files, or sudden loss of data.\n\nAnd nobody wants to wake up one morning and hear, “Your website is showing Japanese text.” That one is not branding. That is a problem.\n\n### 4. Hosting Supports Your Business Email\n\nIf you want your business to look professional, you should not always use only free email addresses like mybusiness@gmail.com.\n\nA professional business email looks like info@yourbusiness.com, sales@yourbusiness.com, or support@yourbusiness.com. This gives your business more credibility.\n\nGood hosting can support business email, helping you communicate with customers professionally. It makes your business look more serious and trustworthy.\n\nFor example, if two people send you proposals, one from greatcompany@gmail.com and another from hello@greatcompany.com, be honest, the second one feels more professional.\n\n### 5. Hosting Gives You Peace of Mind\n\nThis is one part many business owners do not think about until something goes wrong.\n\nYou do not just need hosting. You need someone who understands hosting, websites, SSL, email, backups, renewals, and support.\n\nBecause when your website goes down, you do not want to start learning server settings by 11:45pm.\n\nYou want to message someone and say, “Please check my website.” And the person understands what to do.\n\nThat is why managed web hosting or website care is better for many small businesses. You are not just paying for server space. You are paying for peace of mind.\n\n## Domain Name vs Web Hosting: What Is the Difference?\n\nThis confuses many people, so let us make it simple.\n\nDomain name is your website address, like yourbusiness.com. Web hosting is the online space where your website files are stored. Website is the actual pages, images, text, and features people see. Business email is the professional email attached to your domain.\n\nSo when you are starting online, you usually need domain name, web hosting, website design, and business email — and NAI TALK can help you handle all of these in one place.\n\n## What Type of Businesses Need Web Hosting?\n\nAlmost every serious business that wants to be found online needs hosting.\n\nThis includes small businesses, schools, churches, clinics, real estate companies, NGOs, consultants, personal brands, online stores, restaurants, event planners, training companies, radio stations, and professional service businesses.\n\nIf customers need to find you, trust you, contact you, book you, read about you, or buy from you online, then your website needs hosting.\n\n## What Should Good Hosting Include?\n\nA good hosting plan should give you more than just “space.” For a business website, look out for reliable uptime, free or active SSL security, professional business email, regular backup, good support, renewal reminders, website recovery support, simple management, security monitoring, and peace of mind.\n\nNotice that I did not start with complicated words like SSH, FTP, cron jobs, DNS zone, and database limits.\n\nThose things may matter technically, but most business owners do not wake up thinking about them. What matters is that your website works, your email works, your customers can reach you, and you have support when you need help.\n\n## Why Cheap Hosting Can Become Expensive Later\n\nSometimes, the cheapest option looks attractive at first.\n\nBut if the hosting is poor, you may later pay in other ways: website downtime, lost customers, broken email, poor security, slow website, no backup, no support, and emergency repair costs.\n\nCheap hosting is not always bad, but bad hosting is always expensive in the long run.\n\nIf your website is part of your business, you should treat hosting as business infrastructure, not just a small technical expense.\n\n## Web Hosting in Nigeria: What Should Small Businesses Consider?\n\nIf you are choosing web hosting in Nigeria, consider these things: is support easy to reach, can they help with domain and email, do they understand small business needs, can they help when something breaks, do they provide SSL, do they remind you before renewal, and do they offer website care rather than just hosting?\n\nA business owner does not need stress. You already have customers, staff, suppliers, NEPA, fuel price, and Nigerian traffic to think about.\n\nYour website should not join the list of problems.\n\n## How NAI TALK Helps\n\nAt NAI TALK, we help businesses get online and stay online with domain registration, domain transfer, reliable web hosting, website care plans, business email, SSL security, backups, website design, support, renewal reminders, and peace of mind.\n\nWe are not just giving you hosting. We help you manage the important things around your website so you can focus on your business.\n\nWhether you are starting a new business website, moving from another provider, or trying to make your current website more reliable, NAI TALK can help you.\n\n## Final Thought\n\nYour website is your online office. Your domain name is the address. Your hosting is the building. Your website content is the reception, sales team, brochure, and customer service desk.\n\nSo do not build a beautiful website and leave it homeless. Give it a reliable home. Give it security. Give it support. Give yourself peace of mind.\n\n## Ready to Host Your Website?\n\nStart your online journey with reliable web hosting, business email, SSL, backup, and support from NAI TALK. View our Web Hosting page to get started, or choose a Website Care Plan to have us manage it all for you.\n\nLet's talk. We build. You grow.",
            ],
            [
                'title' => 'Why Every Business Needs a Professional Email Address',
                'excerpt' => 'info@yourbusiness.com says something free Gmail and Yahoo addresses never can. Here\'s why it matters more than you think.',
                'image_query' => 'professional email office',
                'content' => "Picture this. You are a bank manager, and two loan proposals land in your inbox on the same morning.\n\nThe first one comes from: sexylegit_ventures001@yahoo.com\n\nThe second one comes from: info@sexylegitventures.com\n\nBoth proposals may contain the exact same figures, the exact same business plan, even the exact same spelling mistakes. But be honest with yourself: which one are you taking seriously before you have even opened the attachment?\n\nThis, my friend, is the quiet, silent damage a free email address can do to a serious business, and most business owners never even notice it happening.\n\n## First Impressions Happen Before You Say a Word\n\nFor many customers, your email address is one of the first things they notice about your business, often before they see your logo, your prices, or your office.\n\n“info@yourbusiness.com” reads as established, professional, and here to stay. “yourbusiness2020@gmail.com” reads as a side project someone is still testing, no offense to side projects, but that is not the impression a growing business wants to give.\n\n## Professional Business Email Builds Instant Credibility\n\nA professional email address builds instant credibility, especially with new customers, banks, and business partners who are deciding whether to trust you with their money.\n\nIt also makes your business look bigger and more organised than it might actually be yet, which is exactly the impression a growing business needs to make while it is still growing into that image.\n\n## It Gives You Control, Not Just Style\n\nBeyond appearances, professional business email gives you real control over how your business communicates.\n\nYou can create separate addresses for different roles, info@, support@, accounts@, without cramming everything into one shared personal inbox. If a staff member leaves the company, you simply close their account, instead of losing access to years of business conversations tied to someone's personal Gmail account that only they can log into.\n\n## “But Gmail Is Free” — We Hear You\n\nYes, Gmail and Yahoo are free, and free feels good, especially when you are starting out. But the cost is not in naira, it is in credibility, and credibility is what convinces a hesitant customer to finally click “pay now” instead of “let me think about it.”\n\nThe good news is that professional business email is neither expensive nor complicated to set up. It comes included with every NAI TALK Website Care Plan, alongside your hosting and domain, so there is nothing extra to configure on your own, and definitely no need to explain to a bank manager why your business email ends in “_001.”\n\n## Final Thought\n\nYour email address is a small detail that quietly does a lot of talking on your behalf, especially to people who have never met you and may never meet you before deciding whether to trust your business.\n\nGive your business the professional email address that matches the seriousness of what you are actually building.\n\nLearn more on our Business Email Hosting page, or view our Website Care Plans to see which package fits your team size.",
            ],
            [
                'title' => 'Website Design Cost in Nigeria: What Business Owners Should Know',
                'excerpt' => 'Website design pricing can vary wildly. Here\'s what actually drives the cost, so you can budget with confidence.',
                'image_query' => 'web design laptop workspace',
                'content' => "“How much will it cost to build my website?”\n\nThis question is the internet version of asking “how much is rice?” in the market. The honest market woman will look at you and ask, “which rice? Foreign or local? One bag or half bag? You want the one that swells well or the one that just fills the pot?”\n\nWebsite design cost in Nigeria works exactly the same way, and the honest answer is always: it depends on what the website actually needs to do for you.\n\n## Why “How Much Does a Website Cost” Has No One Answer\n\nA simple business website with a handful of pages, About, Services, Contact, costs far less than an online store that needs to handle products, payments, and inventory tracking. A school, church, or NGO website with event calendars and donation pages sits somewhere comfortably in between.\n\nThe right question is not “what is the cheapest option,” the right question is “what does my business actually need to look credible and convert visitors into paying customers?”\n\n## The One-off Quote Trap\n\nMany business owners get a website design quote, pay it, and assume that is the end of the story, only for the real costs to show up quietly afterward.\n\nBeyond the design itself, remember that a website also needs a domain name, hosting, and ongoing care to stay secure, backed up, and updated. These are often overlooked in a one-off design quote, then arrive later as “surprise” costs, the same way small chops at a party somehow becomes the most expensive item on the bill.\n\n## What Actually Drives Website Design Cost\n\nA few honest factors decide the final website design cost in Nigeria: the number of pages and how custom each one needs to be, whether you need e-commerce features like payments, product catalogues, or inventory, whether your content and product photos are ready or still need to be created, and how much ongoing support and updates you expect after launch.\n\nNone of these factors are complicated, but a serious website design partner should walk you through them clearly, not hide them until the invoice arrives.\n\n## Our Simple Process\n\nAt NAI TALK, we walk you through a simple process: Consult, Design, Build, Launch, and ongoing Support, so you know exactly what is included at each stage.\n\nYour domain, hosting, and Website Care Plan are bundled in from the start, rather than billed as afterthoughts once your website is already live and your customers are already visiting.\n\n## Final Thought\n\nAsking “how much does a website cost” without context is a bit like asking “how much is rice” without saying which type, how much, or for what occasion.\n\nThe better move is to be clear about what your business actually needs, then work with a partner who prices website design transparently from the very first conversation.\n\nSee examples of our work on our Portfolio page, or start a conversation about your project on our Website Design page today.",
            ],
        ];

        foreach ($posts as $index => $post) {
            $image = $pexels->firstImageFor($post['image_query']);
            $slug = \Illuminate\Support\Str::slug($post['title']);

            BlogPost::query()->updateOrCreate(['slug' => $slug], [
                'title' => $post['title'],
                'excerpt' => $post['excerpt'],
                'content' => $post['content'],
                'featured_image_url' => $image['url'],
                'featured_image_meta' => $image,
                'author_name' => 'Admin',
                'status' => 'published',
                'published_at' => now()->subDays(count($posts) - $index),
                'seo_title' => $post['title'].' | NAI TALK',
                'seo_description' => $post['excerpt'],
            ]);
        }
    }

    private function seedKnowledgeBase(): void
    {
        $groups = [
            ['name' => 'Dashboard Overview', 'slug' => 'dashboard-overview', 'icon' => 'LayoutDashboard'],
            ['name' => 'Services Catalog', 'slug' => 'services-catalog', 'icon' => 'PackageCheck'],
            ['name' => 'Orders & Invoices', 'slug' => 'orders-invoices', 'icon' => 'FileText'],
            ['name' => 'Domains & DNS', 'slug' => 'domains-dns', 'icon' => 'Globe2'],
            ['name' => 'Wallet & Payments', 'slug' => 'wallet-payments', 'icon' => 'Wallet'],
            ['name' => 'Auto Renewal', 'slug' => 'auto-renewal', 'icon' => 'RefreshCw'],
            ['name' => 'My Profile & Security', 'slug' => 'profile-security', 'icon' => 'ShieldCheck'],
            ['name' => 'Support Tickets', 'slug' => 'support-tickets', 'icon' => 'MessageCircle'],
            ['name' => 'Website Management', 'slug' => 'website-management', 'icon' => 'Server'],
        ];

        $groupModels = [];

        foreach ($groups as $index => $group) {
            $groupModels[$group['slug']] = KnowledgeBaseGroup::query()->updateOrCreate(
                ['slug' => $group['slug']],
                ['name' => $group['name'], 'icon' => $group['icon'], 'sort_order' => $index]
            );
        }

        $articles = [
            ['dashboard-overview', 'Getting Started with Your Client Dashboard', 'A quick tour of your dashboard so you know where everything lives before you start managing services.',
                "Your client dashboard is the home base for everything you do with NAI TALK — it's the first thing you see after logging in.\n\nAt the top, you'll find a summary of your account: active services, wallet balance, outstanding balance, and your next renewal date, so you always know where things stand at a glance.\n\nThe sidebar gives you quick access to every area: your services, orders and invoices, domains, wallet, saved payment methods, your profile, and support tickets. Nothing is more than one click away.\n\nIf you're new, start by checking your Services Catalog to see what's available, then head to My Profile to make sure your business details and communication preferences are set up the way you want them."],
            ['services-catalog', 'How to Order Hosting and Manage Services', 'How to browse plans, place a hosting order, and manage the services you already have.',
                "Ordering hosting takes just a few steps. From the Services Catalog, choose the Website Care Plan that fits your business size, select monthly or annual billing, and add your domain (new or existing).\n\nOnce you review and confirm your order, an invoice is created automatically — you can pay right away with a card, bank transfer, or your NAI TALK wallet, or pay later before the due date.\n\nAfter payment, your service is provisioned automatically and appears under 'My Orders' with its status. From there, you can manage your hosting, add email accounts, and view usage at any time."],
            ['domains-dns', 'How to Search and Register a Domain', 'Step-by-step: searching for a domain, checking availability, and completing registration.',
                "Go to Search Domains from your dashboard (or the public /domains page) and type the name you want. We check availability in real time against the domain registry, so what you see is accurate.\n\nIf it's available, you'll see the registration price and can choose to buy the domain only, or bundle it with a hosting plan in one checkout. If it's taken, we'll suggest similar available alternatives so you're not stuck.\n\nOnce paid, your domain is registered and appears under My Domains, where you can manage auto-renewal, link hosting, or start a transfer at any time."],
            ['domains-dns', 'How to Transfer a Domain', 'What you need before starting a domain transfer, and what happens during the process.',
                "Before transferring a domain to NAI TALK, make sure it's unlocked at your current registrar and that you have its EPP/authorization code — your current provider can give you this.\n\nFrom My Domains, choose 'Transfer a Domain', enter the domain name and EPP code, and we'll check eligibility immediately. Transfers typically take a few days to complete on the registry side, and your domain continues working normally throughout.\n\nYou'll get a notification at each stage, and once complete, your domain appears in My Domains just like one registered directly with us."],
            ['orders-invoices', 'How to Pay an Invoice', 'The payment methods available for settling an invoice, step by step.',
                "Open the invoice from My Orders or the link in your invoice email. You'll see a 'Pay Now' section with every available method: card payment via Paystack or Flutterwave, direct bank transfer, or your NAI TALK wallet balance.\n\nCard and wallet payments confirm instantly. Bank transfers ask you to upload proof of payment, which our team verifies — you'll get a notification once it's confirmed.\n\nIf you ever pay slightly more or less than the invoice total by mistake, we handle it automatically: overpayments are credited to your wallet, and underpayments keep the balance outstanding until settled."],
            ['wallet-payments', 'How to Fund Your Wallet', 'Adding money to your NAI TALK wallet for faster future payments.',
                "Go to Wallet from your dashboard and choose 'Fund Wallet'. You can add any amount using a card via Paystack or Flutterwave — funds reflect in your balance immediately after a successful payment.\n\nYour wallet balance can then be used to pay any invoice instantly, without re-entering card details, and can also be set as your preferred method for auto-renewals."],
            ['wallet-payments', 'How to Use Pay with Wallet', 'Using your wallet balance to settle an invoice in one click.',
                "On any unpaid invoice, select 'Pay with Wallet' from the payment options. If your balance covers the full amount, the invoice is marked paid instantly. If your balance only covers part of it, that portion is applied and the remaining balance stays outstanding for you to complete with another method."],
            ['wallet-payments', 'How to Manage Saved Cards', 'Viewing, disabling, or removing a saved payment card.',
                "Saved cards appear automatically after your first successful card payment — no extra setup needed. From Saved Payment Methods, you can mark a card as default, enable or disable it for auto-renewal, or remove it entirely. We only ever store a secure card token, never your full card number."],
            ['auto-renewal', 'How Auto-Renewal Works', 'What triggers an auto-renewal charge, and how to control which method is used.',
                "Auto-renewal is turned on by default for new services, so you never lose a domain or hosting plan to an expired date you forgot about. A few days before renewal, we generate the invoice and attempt payment automatically using your wallet balance first, then a saved card if enabled.\n\nYou'll always get an email confirming what happened. You can turn auto-renewal off at any time from a service's management page if you'd rather pay manually."],
            ['profile-security', 'How to Update Your Profile', 'Editing your personal and company information from My Profile.',
                "From My Profile, select 'Edit Profile' to update your name, phone number, address, and company details like business name, website, and industry. Changes save immediately and don't require re-verifying your email."],
            ['support-tickets', 'How to Raise a Support Ticket', 'Getting help quickly from our support team.',
                "You can reach support directly via WhatsApp from any page, or by opening a support ticket from your dashboard describing the issue. Include your service or domain name so our team can look into it faster. We aim to respond to all tickets promptly, with priority support included on Business and Premium Website Care plans."],
            ['website-management', 'How to Add Hosting to a Domain', 'Adding a Website Care Plan to a domain you already own with us.',
                "From My Domains, select a domain that doesn't have hosting yet and choose 'Add Hosting'. Pick a Website Care Plan and billing cycle, and an invoice is created for the hosting only — your existing domain registration is untouched and simply gets linked to the new service once paid."],
            ['orders-invoices', 'How to View Your Invoices', 'Finding and downloading any invoice on your account.',
                "All your invoices live under My Orders, each showing its status (paid, unpaid, overdue) and due date. Click any invoice to view the full breakdown or download a PDF copy for your records."],
            ['website-management', 'How to Renew a Service', 'Manually renewing a domain or hosting service before or after auto-renewal.',
                "If auto-renewal is off, or you'd like to renew early, open the service from My Orders or My Domains and select 'Renew'. This creates a renewal invoice you can pay immediately with any supported method, extending your service by the billing period you choose."],
        ];

        foreach ($articles as $index => [$groupSlug, $title, $summary, $content]) {
            KnowledgeBaseArticle::query()->updateOrCreate(
                ['slug' => \Illuminate\Support\Str::slug($title)],
                [
                    'group_id' => $groupModels[$groupSlug]->id,
                    'title' => $title,
                    'summary' => $summary,
                    'content' => $content,
                    'sort_order' => $index,
                    'status' => 'published',
                    'last_updated_at' => now()->subDays(5),
                    'seo_title' => $title.' | NAI TALK Knowledge Base',
                    'seo_description' => $summary,
                ]
            );
        }
    }

    private function seedFaqs(): void
    {
        $faqs = [
            'Domains' => [
                ['Can I buy only a domain without hosting?', 'Yes. You can register or transfer a domain on its own and add hosting to it whenever you\'re ready — there\'s no requirement to buy both together.'],
                ['Can I buy hosting later after buying a domain?', 'Absolutely. From your dashboard, open the domain and choose "Add Hosting" — your existing registration stays exactly as it is.'],
                ['Can I transfer my domain to NAI TALK?', 'Yes, as long as it\'s unlocked and you have its EPP/authorization code from your current registrar. Most transfers complete within a few days.'],
                ['What happens if I don\'t renew my domain?', 'You\'ll get renewal reminders before the expiry date. If a domain does expire, there\'s usually a short grace period before it becomes available to the public again — but renewing on time is always the safest option.'],
            ],
            'Hosting' => [
                ['What happens if my hosting expires?', 'Your website and email may go offline. We send renewal reminders in advance, and auto-renewal (on by default) helps you avoid this entirely.'],
                ['Do I need technical knowledge to use your hosting?', 'No. Our hosting and Website Care Plans are built so you never have to touch a server or configuration file — we handle the technical side for you.'],
                ['Can I move my existing website to NAI TALK?', 'Yes, we can help migrate an existing website — get in touch and our team will guide you through it.'],
            ],
            'Website Care' => [
                ['What is Website Care?', 'A monthly or yearly plan that bundles hosting, security, backups, professional email, and support — so your website stays online, safe, and looked after without you needing any technical knowledge.'],
                ['Which Website Care plan should I choose?', 'Starter suits a simple single-site business, Business Care (our most popular) suits growing businesses needing more email accounts and priority support, and Premium suits businesses wanting the most frequent checks and support.'],
            ],
            'Payments' => [
                ['Can I pay monthly?', 'Yes, most plans offer monthly or annual billing — annual billing usually works out cheaper over the year.'],
                ['What payment methods do you accept?', 'Card payments via Paystack or Flutterwave, direct bank transfer, and your NAI TALK wallet balance.'],
                ['What if I overpay or underpay an invoice?', 'Overpayments are automatically credited to your wallet for future use. Underpayments simply leave the remaining balance outstanding until it\'s settled.'],
            ],
            'Wallet' => [
                ['Can I use my wallet to pay invoices?', 'Yes — wallet payments confirm instantly and can also be set as your preferred method for auto-renewals.'],
                ['How do I add money to my wallet?', 'From the Wallet page in your dashboard, choose "Fund Wallet" and pay by card — your balance updates immediately.'],
            ],
            'Support' => [
                ['How do I contact support?', 'Chat with us on WhatsApp anytime, or raise a support ticket from your client dashboard describing your issue.'],
                ['Is support included in my plan?', 'Yes, every Website Care plan includes support, with priority response times on Business and Premium plans.'],
            ],
            'Website Design' => [
                ['How long does a website take to build?', 'It depends on complexity, but most business websites are ready within a few weeks once content and requirements are confirmed.'],
                ['Do you design websites for schools, churches, and NGOs?', 'Yes, we\'ve built websites for a range of organisations beyond standard businesses, each tailored to their specific needs.'],
            ],
            'Email' => [
                ['What is business email?', 'A professional email address using your own domain (like info@yourbusiness.com) instead of a free Gmail or Yahoo address — it looks more credible and is fully under your control.'],
                ['Is business email included in Website Care Plans?', 'Yes, every plan includes at least one professional business email account, with higher plans including more.'],
            ],
        ];

        $sortOrder = 0;

        foreach ($faqs as $group => $items) {
            foreach ($items as [$question, $answer]) {
                Faq::query()->updateOrCreate(
                    ['group' => $group, 'question' => $question],
                    ['answer' => $answer, 'sort_order' => $sortOrder++, 'status' => 'published']
                );
            }
        }
    }

    private function seedServiceStatuses(): void
    {
        $services = [
            'Website Services',
            'Hosting Services',
            'Domain Search & Registration',
            'Email Service',
            'Payment Processing',
            'Support Availability',
        ];

        foreach ($services as $index => $name) {
            ServiceStatus::query()->updateOrCreate(
                ['service_name' => $name],
                ['status' => 'operational', 'sort_order' => $index]
            );
        }
    }
}

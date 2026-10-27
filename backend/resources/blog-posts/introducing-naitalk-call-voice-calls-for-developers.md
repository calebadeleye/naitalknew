If you are building an app and you want your users to talk to each other, you have probably met this problem already. Voice calls look simple on the surface. Then you start reading about media servers, TURN servers, signalling, scaling and keeping it all running at two in the morning, and suddenly a "call button" has become a whole infrastructure project.

That is why we built **Naitalk Call**: hosted voice calls for your app, running on NAI TALK's servers, with plans that start free and Naira pricing that follows the Central Bank of Nigeria's official rate.

In this article, we explain what Naitalk Call is, what you can build with it, how it works, what each plan includes, and how to choose the right one for your app.

## What Is Naitalk Call?

Naitalk Call is a voice call service for developers. Under the hood it is **LiveKit**, the open-source real-time communication platform, hosted and looked after by NAI TALK.

That means you do not learn a new, closed SDK. You use the standard LiveKit client libraries for web, iOS, Android and Flutter, and point them at Naitalk Call using the key we give you. Any LiveKit tutorial you find online applies.

You get your own API key and secret, your own room-name prefix, and your own webhook for call events. We host the media server, keep it updated and watch it, so your team can spend its time on your product instead.

## What Can You Build With Naitalk Call?

Naitalk Call is built for voice. Typical uses include:

- One-to-one calls between two users inside your app, such as a tutor and a student, a seller and a buyer, or two members of a community.
- Group calls where several people talk at once.
- Live audio rooms, where hosts bring listeners up to speak, like a community discussion or a live Q&A.
- Support and consultation calls that start from a button in your app instead of sending people to a phone number.

If you need video, talk to us. The plans are designed for voice calls and audio rooms.

## How Naitalk Call Works

Getting from nothing to your first call takes three steps.

### 1. Pick a plan

Start on the free plan while you build, then choose the paid plan that fits your monthly usage when you go live. You can start from the [Naitalk Call page](/naitalk-call) or [contact us](/contact?service=Naitalk%20Call) and tell us which plan you want.

### 2. Get your key

We set up your app and give you an API key, a secret and a room-name prefix for your calls. If a key is ever exposed, tell us and we can replace or switch off the old one.

### 3. Start calling

Add the LiveKit SDK to your app. Your own server creates a short access token for each user, signed with the key and secret we gave you, and your app uses that token to join a room. From there your users can talk.

Every business gets its own prefix, for example yourbrand-. Rooms that start with it are yours, which is how we send you your events and count your minutes. LiveKit has server libraries for Node.js, Python, Go and other languages, so the token step is only a few lines on a small server. If you need somewhere to run it, our [web hosting](/web-hosting) plans can host Node.js apps.

## Naitalk Call Plans and Pricing

Plans are priced in US dollars per month. Each plan includes a monthly allowance of participant-minutes, which reset every month. (We explain participant-minutes in the next section.)

### Free: $0 a month

- 5,000 participant-minutes
- For testing while you build, not for live traffic
- One-to-one and group voice calls
- Web, iOS and Android SDKs
- Your own API key and webhooks

### Starter: $20 a month

- 50,000 participant-minutes
- For developers launching an app
- One-to-one and group voice calls, with no arbitrary room-size restriction by subscription tier
- Web, iOS and Android SDKs
- API access and a usage dashboard
- Upgrade whenever you need more minutes

### Growth: $49 a month

- 200,000 participant-minutes
- For growing apps
- Everything in Starter
- A larger monthly usage allowance
- Usage alerts and billing reports (we email you when you reach 80% and 100% of your minutes)
- A higher API request allowance

### Business: $99 a month

- 500,000 participant-minutes
- For established apps
- Everything in Growth
- Higher usage and API allowances
- Priority support
- Options for capacity planning as demand grows

See the current prices, including the Naira amounts, on the [Naitalk Call plans page](/naitalk-call#naitalk-call-plans).

## What Is a Participant-Minute?

A participant-minute is **one person in a call for one minute**. That is the only thing we count.

A few examples make it clear:

- A 10-minute call between 2 people uses 20 participant-minutes.
- A 10-minute call between 3 people uses 30 participant-minutes.
- A one-hour audio room with 50 people in it uses 3,000 participant-minutes.

So what does a plan give you in practice?

- Free (5,000): about 250 ten-minute one-to-one calls, plenty for building and testing.
- Starter (50,000): about 2,500 ten-minute one-to-one calls, or about 1,660 ten-minute calls between three people.
- Growth (200,000): about 10,000 ten-minute one-to-one calls in a month.
- Business (500,000): about 25,000 ten-minute one-to-one calls in a month.

Work out how many calls your users make and how long they stay on, multiply by the number of people, and you will see which plan fits.

## Can You Pay in Naira?

Yes. Plans are priced in dollars, and the Naira amount uses the **Central Bank of Nigeria's official exchange rate**, which we fetch every day. You always see the Naira price and the rate date on the plans page, so there are no surprises, and the price follows the official rate. VAT is added where it applies.

For many Nigerian developers, this is a big deal. You can pay in Naira through NAI TALK, so you do not have to find dollars just to give your app voice calls.

## Why Use a Hosted Service Instead of Running LiveKit Yourself?

LiveKit is open source, so you can run it yourself, and many teams do. The question is whether you should spend your time on it.

Running your own media server means setting up and securing servers, configuring networking so calls connect from phones behind different networks, keeping the software updated, and watching it so you find problems before your users do. That is real, ongoing work, and it is work that does not make your app better.

With Naitalk Call, we do that part. You keep the open-source SDKs you already know, you are not locked into a special API, and you get a simple monthly plan, a usage dashboard in your NAI TALK client area on the paid plans, and a company you can reach if something needs attention.

## Which Naitalk Call Plan Should You Choose?

- **Still building?** Take the Free plan. It gives you your own key to test with. Move up when you go live.
- **Launching an app?** Starter is made for you. It has 50,000 participant-minutes, API access and a usage dashboard.
- **Calls are growing?** Growth adds a larger allowance, usage alerts and billing reports, so you hear from us before you run out.
- **Calls are central to your business?** Business gives you the biggest allowance, priority support and room to plan capacity as demand grows.

## Frequently Asked Questions About Naitalk Call

### Is Naitalk Call only for voice?

Naitalk Call is built for voice calls and audio rooms. If you need video, talk to us and we will tell you what is possible.

### Which SDKs can I use?

The standard LiveKit client SDKs for web, iOS, Android and Flutter. You point them at Naitalk Call with the key we give you.

### Can I try it before paying?

Yes. The Free plan gives you your own key to build and test with. It is meant for development and testing, so move to Starter or above when you go live.

### What happens if I use more minutes than my plan includes?

Calls keep working. We let you know as you get close, and you can move up to a bigger plan.

### How do I get my key?

Choose a plan on the [Naitalk Call page](/naitalk-call) or [contact us](/contact?service=Naitalk%20Call). We set up your app and give you your API key, secret and room-name prefix.

### Do webhooks come with it?

Yes. We send room and participant events to your webhook, signed so you can check they really came from us.

## Get Started With Naitalk Call

If your app needs voice, you no longer have to build the infrastructure first. Start on the free plan, build your first call with the LiveKit SDK you already know, and upgrade when your users arrive.

See the plans and pricing on the [Naitalk Call page](/naitalk-call), or [talk to us](/contact?service=Naitalk%20Call) about what you are building.

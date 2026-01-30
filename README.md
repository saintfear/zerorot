# ZeroRot

AI-powered Instagram content discovery and personalized newsletter service.

## Features

- 🎯 Personalized content preferences
- 🤖 AI-powered content discovery
- 📧 Daily email newsletters
- 🔍 Instagram content scraping and analysis
- 👤 User authentication

## Setup

1. Install dependencies:
```bash
npm run setup
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Set up database:
```bash
npx prisma migrate dev
npx prisma generate
```

4. Run the application:
```bash
npm run dev
```

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: SQLite with Prisma ORM
- **AI**: OpenAI API
- **Email**: Nodemailer
- **Scheduling**: node-cron

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Project Structure

```
zerorot/
├── client/              # Next.js frontend
│   ├── app/            # Next.js app directory
│   ├── lib/            # API client utilities
│   └── ...
├── server/             # Express backend
│   ├── routes/        # API routes
│   ├── services/      # Business logic (scraper, AI, email)
│   ├── jobs/          # Scheduled jobs (newsletter)
│   └── middleware/    # Auth middleware
├── prisma/            # Database schema
└── ...
```

## Important Notes

⚠️ **Instagram Scraping**: Instagram has strict terms of service regarding scraping. This application uses scraping techniques that may violate Instagram's ToS. For production use, consider:
- Using Instagram Basic Display API (requires user authorization)
- Using Instagram Graph API (for business accounts)
- Partnering with official Instagram data providers

Make sure to comply with Instagram's terms of service and rate limits.

## Features

- ✅ User authentication (signup/login)
- ✅ Content preferences management
- ✅ AI-powered content discovery
- ✅ Instagram content scraping (with fallback to mock data)
- ✅ Email newsletter generation and sending
- ✅ Daily automated newsletter delivery (8 AM)
- ✅ Beautiful, modern UI with Tailwind CSS

## Phil Notes

Problem: People go on Instagram to search for valuable content specific to their interests (for example, I go on Instagram to find beautiful anime art), but since that content is buried in memes on their FYP, they end up doomscrolling instead.


Customer: Instagram users who want to find valuable content tailored to their taste in a specific category (examples: French cooking, modern farmhouse interior design, cyberpunk fashion), and don’t want exposure to brainrot.


Solution: ZeroRot uses AI to data-scrape Instagram. Train it on the content you want to see more of, and it’ll find new content you’d like, transplant it from Instagram into a cute document, and deliver it to your inbox daily.

Notes: People will only go on the website to configure their preferences for what kind of posts they want included in the newsletter, so they won’t ever spend time looking through posts collected there. On a day-to-day basis, they’ll only read the newsletter ZeroRot sends to their inbox. ‘Discover Content’ and ‘Send Test Newsletter’ take a long time to run. The program works best if you input as many topics/hashtags and accounts you like as possible (press enter after each one so they save as separate items).

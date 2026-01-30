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

The intention of ZeroRot is to provide a daily email newsletter containing quality posts from Instagram, tailored to the user’s taste. It is geared towards people who would normally go on Instagram to search for creative and beautiful content, but refuse to because of the addictive nature of Instagram.

People will only go on the website to configure their preferences for what kind of posts they want included in the newsletter, so they won’t ever spend time looking through posts collected there. On a day-to-day basis, they’ll only read the newsletter ZeroRot sends to their inbox.

‘Discover Content’ and ‘Send Test Newsletter’ take a long time to run, fyi. The program works best if you input as many topics/hashtags and accounts you like as possible (press enter after each one so they save as separate items).

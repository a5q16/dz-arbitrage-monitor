# DZ Arbitrage Monitor

Automated arbitrage & market-monitoring system targeting the Algerian market for gaming consoles.

## Architecture

```
Leboncoin (MCP)  ──→  Groq (Weight)  ──→  Colissimo (Cost)
                                              │
                  Apify (FB) + ScrapingBee ──→ Groq (Price Analysis)
                  (Ouedkniss)                  │
                                              ▼
                                    Margin >= 10,000 DZD?
                                     ├─ YES → Telegram Alert + Seller Message
                                     └─ NO  → Skip
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Run the monitor
npm start
```

## Project Structure

```
src/
├── index.js                    # Main pipeline orchestrator
├── config/
│   ├── index.js                # Centralized configuration
│   └── logger.js               # Winston logger setup
├── sourcing/
│   └── leboncoinPoller.js      # Leboncoin MCP polling + seller messaging
├── analysis/
│   ├── weightEstimator.js      # Groq weight estimation (Step 2)
│   ├── costCalculator.js       # Colissimo tariff + landed cost (Step 3)
│   └── priceAnalyzer.js        # Groq market price analysis (Step 4b)
├── scrapers/
│   ├── facebookMarketplace.js  # Apify FB Marketplace scraper (Step 4a)
│   └── ouedkniss.js            # ScrapingBee Ouedkniss scraper (Step 4a)
└── notifications/
    └── telegram.js             # Telegram alert formatting + sending
```

## Scripts

| Command              | Description                     |
|----------------------|---------------------------------|
| `npm start`          | Run the full arbitrage monitor  |
| `npm run dev`        | Run with file-watch auto-reload |
| `npm run scrape:fb`  | Test FB Marketplace scraper     |
| `npm run scrape:ouedkniss` | Test Ouedkniss scraper    |

## API Keys Required

- **Groq** – `GROQ_API_KEY` ([console.groq.com](https://console.groq.com))
- **Apify** – `APIFY_API_TOKEN` ([apify.com](https://apify.com))
- **ScrapingBee** – `SCRAPINGBEE_API_KEY` ([scrapingbee.com](https://scrapingbee.com))
- **Telegram** – `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` ([@BotFather](https://t.me/BotFather))

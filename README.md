# XAUUSD Watcher - Institutional Gold Intelligence Terminal

## Overview
Production-grade, zero-latency macroeconomic, geopolitical, and technical intelligence terminal for Gold (OANDA:XAUUSD). Built on the WorldWatcher architecture with institutional-grade features.

## Features
- **Live Gold Price**: OANDA spot XAUUSD with millisecond flash indicators
- **Bias Engine**: Multi-factor algorithmic scoring (-100 to +100)
- **News Terminal**: Real-time RSS aggregation with NLP sentiment classification
- **Economic Calendar**: High-impact events with live countdowns and deviation analysis
- **Geopolitics Radar**: GDELT/ACLED conflict tracking, DEFCON threat gauge
- **Intermarket Matrix**: Rolling correlations (DXY, US10Y, TIPS, WTI, XAG)
- **Liquidity Scanner**: OANDA order book, FVGs, EQH/EQL, session levels
- **TradingView Chart**: Embedded Advanced Real-Time Chart widget

## Quick Start

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## Deployment (Render Free Tier)

1. Connect GitHub repository to Render
2. Create Web Service with:
   - Build Command: `npm install && npm run build`
   - Start Command: `node api/server.js`
3. Add Environment Variables:
   - `OANDA_API_KEY` (optional)
   - `OANDA_ACCOUNT_ID` (optional)
   - `FRED_API_KEY` (optional)
   - `ALPHA_VANTAGE_API_KEY` (optional)
4. Deploy

### Keepalive (cron-job.org)
1. Create free account at cron-job.org
2. Add cronjob: `https://your-app.onrender.com/api/health`
3. Schedule: Every 9 minutes (`*/9 * * * *`)
4. Method: GET

## Architecture
```
xauusd-watcher/
├── api/                 # Express proxy server + API endpoints
├── src/
│   ├── components/      # UI Panels (Vanilla TS)
│   ├── config/          # Feeds, thresholds, geopolitics, panels
│   ├── services/        # Core services (stream, bias, correlation, NLP)
│   ├── workers/         # Web Workers (analysis, feed processing)
│   └── styles/          # CSS (main, panels, terminal)
└── scripts/             # Deployment scripts
```

## Data Sources
- **Gold Price**: OANDA v20, Alpha Vantage, MetalPriceAPI
- **News**: BBC, Al Jazeera, Reuters, Investing.com, Kitco, Defense One, etc.
- **Macro**: FRED (CPI, NFP, FOMC, PCE, GDP)
- **Geopolitics**: GDELT 2.0 Geo API
- **Intermarket**: FRED (DXY, US10Y, TIPS, WTI), Alpha Vantage (XAG)
- **Order Book**: OANDA Client Order Book

## Bias Engine Weights
| Factor | Weight | Description |
|--------|--------|-------------|
| Real Yields | 25% | 10Y TIPS, breakeven rates |
| DXY Momentum | 25% | Dollar index vs MA20/ATR |
| Geopolitical | 20% | GDELT conflict intensity |
| Macro Surprise | 15% | CPI/NFP/FOMC deviations |
| Technical | 15% | EMA/RSI/FVG/Order flow |

## Tech Stack
- **Frontend**: Vanilla TypeScript + Vite (no React/Vue overhead)
- **Styling**: CSS Grid/Flexbox, CSS Variables, Dark tactical theme
- **Concurrency**: Web Workers for NLP, bias calc, correlation
- **Real-time**: WebSocket + SSE with adaptive polling fallback
- **Backend**: Node.js/Express proxy with TTL cache & rate limiting
- **Deploy**: Render Free Web Service + cron-job.org keepalive

## License
MIT
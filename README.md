# XAUUSD Watcher - Institutional Gold Intelligence Terminal

## Overview
Production-grade, zero-latency macroeconomic, geopolitical, and technical intelligence terminal for Gold (XAUUSD). **100% free to run - no API keys required.** Built on the WorldWatcher architecture with institutional-grade features.

## Features
- **Live Gold Price**: Multi-source (metals.live, gold-api.com, exchangerate.host) with millisecond flash indicators
- **Bias Engine**: Multi-factor algorithmic scoring (-100 to +100)
- **News Terminal**: Real-time RSS aggregation with NLP sentiment classification
- **Economic Calendar**: High-impact events with live countdowns and deviation analysis
- **Geopolitics Radar**: GDELT 2.0 conflict tracking, DEFCON threat gauge
- **Intermarket Matrix**: Rolling correlations (DXY, US10Y, TIPS, WTI, XAG)
- **Liquidity Scanner**: Order book, FVGs, EQH/EQL, session levels
- **TradingView Chart**: Embedded Advanced Real-Time Chart widget (OANDA:XAUUSD)

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
3. **No environment variables needed!** Works 100% free out of the box.
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

## Data Sources (All FREE - No Keys Required)
- **Gold Price**: metals.live, gold-api.com, exchangerate.host
- **News**: BBC, Al Jazeera, Reuters, Investing.com, Kitco, Defense One (RSS)
- **Macro Calendar**: Static high-impact schedule with mock data (FRED optional)
- **Geopolitics**: GDELT 2.0 Geo API (free)
- **Intermarket**: exchangerate.host (DXY, yields), metals.live (XAG), free commodity APIs
- **Order Book**: Mock data with realistic structure (OANDA optional)

## Bias Engine Weights
| Factor | Weight | Description |
|--------|--------|-------------|
| Real Yields | 25% | 10Y TIPS, breakeven rates |
| DXY Momentum | 25% | Dollar index vs MA20/ATR |
| Geopolitical | 20% | GDELT conflict intensity |
| Macro Surprise | 15% | CPI/NFP/FOMC deviations |
| Technical | 15% | EMA/RSI/FVG/Order flow |

## Optional API Keys (for higher rate limits)
| Service | Free Tier | Get Key |
|---------|-----------|---------|
| OANDA | Demo account | oanda.com |
| FRED | Free | fred.stlouisfed.org |
| Alpha Vantage | 5 req/min | alphavantage.co |

Add to Render Environment Variables if desired (not required).

## Tech Stack
- **Frontend**: Vanilla TypeScript + Vite (no React/Vue overhead)
- **Styling**: CSS Grid/Flexbox, CSS Variables, Dark tactical theme
- **Concurrency**: Web Workers for NLP, bias calc, correlation
- **Real-time**: WebSocket + SSE with adaptive polling fallback
- **Backend**: Node.js/Express proxy with TTL cache & rate limiting
- **Deploy**: Render Free Web Service + cron-job.org keepalive

## License
MIT
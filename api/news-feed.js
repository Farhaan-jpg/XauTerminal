import fetch from 'node-fetch';
import Parser from 'rss-parser';
import { getCached, setCache, getStale } from './_cache.js';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'XAUUSD-Watcher/1.0' },
});

const FEEDS = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'geopolitics', tier: 1 },
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'macro', tier: 1 },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'geopolitics', tier: 2 },
  { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', category: 'macro', tier: 1 },
  { name: 'Investing.com Gold', url: 'https://www.investing.com/rss/news_285.rss', category: 'gold', tier: 3 },
  { name: 'Investing.com Commodities', url: 'https://www.investing.com/rss/news_301.rss', category: 'commodities', tier: 3 },
  { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'macro', tier: 2 },
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'macro', tier: 2 },
  { name: 'Financial Times', url: 'https://www.ft.com/rss/home', category: 'macro', tier: 2 },
  { name: 'Defense One', url: 'https://www.defenseone.com/rss/all/', category: 'defense', tier: 3 },
  { name: 'Breaking Defense', url: 'https://breakingdefense.com/feed/', category: 'defense', tier: 3 },
  { name: 'The War Zone', url: 'https://www.thedrive.com/the-war-zone/rss', category: 'defense', tier: 3 },
  { name: 'GoldSeek', url: 'https://www.goldseek.com/rss.xml', category: 'gold', tier: 4 },
  { name: 'Kitco News', url: 'https://www.kitco.com/rss/KitcoNews.xml', category: 'gold', tier: 3 },
];

const GOLD_KEYWORDS = [
  'gold', 'xau', 'xauusd', 'bullion', 'precious metal', 'safe haven',
  'fed', 'federal reserve', 'fomc', 'interest rate', 'rate cut', 'rate hike',
  'inflation', 'cpi', 'ppi', 'pce', 'yield', 'treasury', 'real yield',
  'dollar', 'dxy', 'usd', 'currency', 'debasement',
  'war', 'conflict', 'geopolitical', 'tension', 'escalation', 'invasion',
  'central bank', 'reserve', 'buying', 'etf', 'gld', 'iag',
];

const CRISIS_KEYWORDS = {
  CRITICAL_BULLISH: ['war', 'invasion', 'nuclear', 'missile strike', 'escalation', 'conflict', 'crisis'],
  BULLISH: ['safe haven', 'geopolitical tension', 'fed cut', 'dovish', 'inflation high', 'recession'],
  BEARISH: ['fed hawkish', 'rate hike', 'strong dollar', 'dxy surge', 'yields spike', 'risk on'],
};

function classifySentiment(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  let score = 0;
  let category = 'NEUTRAL';

  for (const kw of GOLD_KEYWORDS) {
    if (text.includes(kw)) score += 1;
  }

  for (const [level, keywords] of Object.entries(CRISIS_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        if (level === 'CRITICAL_BULLISH') score += 3;
        else if (level === 'BULLISH') score += 1;
        else if (level === 'BEARISH') score -= 1;
        category = level.replace('_', ' ');
      }
    }
  }

  if (score >= 3) return { category: 'WAR_CRISIS', impact: 3, label: 'CRITICAL BULLISH (+3)' };
  if (score >= 1) return { category: 'INFLATION', impact: 1, label: 'BULLISH (+1)' };
  if (score <= -1) return { category: 'FED_POLICY', impact: -1, label: 'BEARISH (-1)' };
  return { category: 'COMMODITY_DEMAND', impact: 0, label: 'NEUTRAL (0)' };
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function newsFeedHandler(req, res) {
  const cacheKey = 'news:feed';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const allItems = [];
    const errors = [];

    await Promise.allSettled(FEEDS.map(async (feed) => {
      try {
        const feedData = await parser.parseURL(feed.url);
        const items = feedData.items.slice(0, 10).map(item => ({
          id: item.guid || item.link,
          title: item.title,
          summary: item.contentSnippet || item.summary || '',
          link: item.link,
          pubDate: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
          source: feed.name,
          category: feed.category,
          tier: feed.tier,
        }));
        allItems.push(...items);
      } catch (e) {
        errors.push(`${feed.name}: ${e.message}`);
      }
    }));

    const uniqueItems = deduplicate(allItems)
      .sort((a, b) => b.pubDate - a.pubDate)
      .slice(0, 50)
      .map(item => ({ ...item, ...classifySentiment(item.title, item.summary) }));

    const result = { items: uniqueItems, errors, timestamp: Date.now() };
    setCache(cacheKey, result, 15000, 30000);
    res.json(result);
  } catch (error) {
    console.error('[news-feed] Error:', error);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    res.json({ items: [], errors: ['Feed unavailable'], timestamp: Date.now() });
  }
}
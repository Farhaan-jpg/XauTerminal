export interface FeedSource {
  name: string;
  url: string;
  category: 'geopolitics' | 'macro' | 'gold' | 'commodities' | 'defense' | 'central_bank';
  tier: 1 | 2 | 3 | 4;
  enabled: boolean;
}

export const FEED_SOURCES: FeedSource[] = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'geopolitics', tier: 1, enabled: true },
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'macro', tier: 1, enabled: true },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'geopolitics', tier: 2, enabled: true },
  { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', category: 'macro', tier: 1, enabled: true },
  { name: 'Investing.com Gold', url: 'https://www.investing.com/rss/news_285.rss', category: 'gold', tier: 3, enabled: true },
  { name: 'Investing.com Commodities', url: 'https://www.investing.com/rss/news_301.rss', category: 'commodities', tier: 3, enabled: true },
  { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'macro', tier: 2, enabled: true },
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'macro', tier: 2, enabled: true },
  { name: 'Financial Times', url: 'https://www.ft.com/rss/home', category: 'macro', tier: 2, enabled: true },
  { name: 'Defense One', url: 'https://www.defenseone.com/rss/all/', category: 'defense', tier: 3, enabled: true },
  { name: 'Breaking Defense', url: 'https://breakingdefense.com/feed/', category: 'defense', tier: 3, enabled: true },
  { name: 'The War Zone', url: 'https://www.thedrive.com/the-war-zone/rss', category: 'defense', tier: 3, enabled: true },
  { name: 'GoldSeek', url: 'https://www.goldseek.com/rss.xml', category: 'gold', tier: 4, enabled: true },
  { name: 'Kitco News', url: 'https://www.kitco.com/rss/KitcoNews.xml', category: 'gold', tier: 3, enabled: true },
  { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', category: 'central_bank', tier: 1, enabled: true },
];

export const POLL_INTERVALS = {
  news: 15000,
  gold: 1000,
  macro: 300000,
  geopolitics: 60000,
  intermarket: 30000,
  orderbook: 15000,
};

export const CACHE_TTL = {
  news: 15000,
  gold: 1000,
  macro: 300000,
  geopolitics: 60000,
  intermarket: 30000,
  orderbook: 15000,
};
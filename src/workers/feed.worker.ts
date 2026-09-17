interface WorkerMessage {
  type: 'PARSE_FEED' | 'DEDUPE' | 'CLASSIFY' | 'FILTER';
  payload: any;
  id: number;
}

interface FeedItem {
  id: string;
  title: string;
  summary: string;
  link: string;
  pubDate: number;
  source: string;
  category: string;
  tier: number;
}

const CATEGORY_KEYWORDS = {
  WAR_CRISIS: ['war', 'invasion', 'conflict', 'attack', 'strike', 'missile', 'bombing', 'casualties', 'troops', 'military', 'offensive', 'ceasefire', 'hostage', 'evacuation', 'artillery', 'airstrike'],
  INFLATION: ['inflation', 'cpi', 'ppi', 'pce', 'price index', 'cost of living', 'purchasing power', 'wage growth', 'core inflation', 'sticky inflation', 'disinflation', 'deflation', 'price pressure'],
  FED_POLICY: ['fed', 'federal reserve', 'fomc', 'interest rate', 'rate cut', 'rate hike', 'monetary policy', 'powell', 'dot plot', 'forward guidance', 'tightening', 'easing', 'policy rate', 'federal funds', 'quantitative'],
  COMMODITY_DEMAND: ['gold', 'silver', 'bullion', 'precious metal', 'safe haven', 'etf', 'gld', 'iag', 'central bank buying', 'reserve asset', 'jewelry demand', 'investment demand', 'commodity', 'xau', 'xag'],
  GEOPOLITICS: ['geopolitical', 'tension', 'escalation', 'sanctions', 'diplomatic', 'summit', 'alliance', 'nato', 'security', 'defense', 'arms', 'nuclear', 'proliferation', 'deterrence'],
  CENTRAL_BANK: ['central bank', 'ecb', 'boe', 'boj', 'pboe', 'rba', 'boc', 'snb', 'reserves', 'gold reserves', 'foreign exchange', 'currency intervention'],
};

const IMPACT_KEYWORDS = {
  CRITICAL_BULLISH: ['war', 'invasion', 'nuclear', 'missile strike', 'major escalation', 'financial crisis', 'systemic risk', 'currency collapse'],
  BULLISH: ['safe haven', 'geopolitical tension', 'fed dovish', 'rate cut expected', 'inflation rising', 'recession fears', 'yield curve inversion', 'central bank buying', 'de-dollarization'],
  BEARISH: ['fed hawkish', 'rate hike', 'strong dollar', 'dxy surge', 'yields spike', 'risk on', 'equity rally', 'inflation cooling', 'soft landing'],
};

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = event.data;
  let result: any;

  try {
    switch (type) {
      case 'PARSE_FEED':
        result = parseFeed(payload.xml, payload.source);
        break;
      case 'DEDUPE':
        result = deduplicate(payload.items);
        break;
      case 'CLASSIFY':
        result = classifyBatch(payload.items);
        break;
      case 'FILTER':
        result = filterByImpact(payload.items, payload.minImpact);
        break;
      default:
        result = { error: 'Unknown message type' };
    }
  } catch (error) {
    result = { error: (error as Error).message };
  }

  self.postMessage({ id, result, type });
};

function parseFeed(xml: string, source: string): FeedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const items = doc.querySelectorAll('item, entry');
  const results: FeedItem[] = [];

  items.forEach((item, index) => {
    const title = item.querySelector('title')?.textContent || '';
    const summary = item.querySelector('description')?.textContent || item.querySelector('summary')?.textContent || '';
    const link = item.querySelector('link')?.textContent || item.querySelector('link')?.getAttribute('href') || '';
    const pubDateStr = item.querySelector('pubDate')?.textContent || item.querySelector('published')?.textContent || '';
    const guid = item.querySelector('guid')?.textContent || link;
    const pubDate = pubDateStr ? new Date(pubDateStr).getTime() : Date.now();

    if (title && link) {
      results.push({
        id: guid,
        title: title.trim(),
        summary: summary.trim().replace(/<[^>]*>/g, ''),
        link,
        pubDate,
        source,
        category: 'unknown',
        tier: 3,
      });
    }
  });

  return results;
}

function deduplicate(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyItem(item: FeedItem) {
  const text = (item.title + ' ' + item.summary).toLowerCase();
  const foundKeywords: string[] = [];
  const categoryScores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        score++;
        foundKeywords.push(kw);
      }
    }
    categoryScores[category] = score;
  }

  let topCategory = 'COMMODITY_DEMAND';
  let maxScore = 0;
  for (const [cat, score] of Object.entries(categoryScores)) {
    if (score > maxScore) {
      maxScore = score;
      topCategory = cat;
    }
  }

  let impact = 0;
  let label = 'NEUTRAL (0)';
  
  for (const [level, keywords] of Object.entries(IMPACT_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        if (level === 'CRITICAL_BULLISH') { impact = 3; label = 'CRITICAL BULLISH (+3)'; }
        else if (level === 'BULLISH') { impact = Math.max(impact, 1); label = 'BULLISH (+1)'; }
        else if (level === 'BEARISH') { impact = Math.min(impact, -1); label = 'BEARISH (-1)'; }
      }
    }
  }

  if (impact === 0 && maxScore > 0) {
    impact = 1;
    label = 'BULLISH (+1)';
  }

  return { ...item, category: topCategory, impact, label, keywords: [...new Set(foundKeywords)] };
}

function classifyBatch(items: FeedItem[]) {
  return items.map(classifyItem);
}

function filterByImpact(items: FeedItem[], minImpact: number) {
  return items.filter(item => (item as any).impact >= minImpact);
}
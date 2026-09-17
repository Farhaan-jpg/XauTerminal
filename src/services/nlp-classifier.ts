export interface ClassifiedItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: 'WAR_CRISIS' | 'INFLATION' | 'FED_POLICY' | 'COMMODITY_DEMAND' | 'GEOPOLITICS' | 'CENTRAL_BANK';
  impact: number;
  label: string;
  keywords: string[];
  pubDate: number;
}

const CATEGORY_KEYWORDS = {
  WAR_CRISIS: [
    'war', 'invasion', 'conflict', 'attack', 'strike', 'missile', 'bombing',
    'casualties', 'troops', 'military', 'offensive', 'ceasefire', 'hostage',
    'evacuation', 'humanitarian crisis', 'refugee', 'artillery', 'airstrike',
  ],
  INFLATION: [
    'inflation', 'cpi', 'ppi', 'pce', 'price index', 'cost of living',
    'purchasing power', 'wage growth', 'core inflation', 'sticky inflation',
    'disinflation', 'deflation', 'price pressure',
  ],
  FED_POLICY: [
    'fed', 'federal reserve', 'fomc', 'interest rate', 'rate cut', 'rate hike',
    'monetary policy', 'powell', 'dot plot', 'forward guidance', 'tightening',
    'easing', 'policy rate', 'federal funds', 'quantitative',
  ],
  COMMODITY_DEMAND: [
    'gold', 'silver', 'bullion', 'precious metal', 'safe haven', 'etf',
    'gld', 'iag', 'central bank buying', 'reserve asset', 'jewelry demand',
    'investment demand', 'commodity', 'xau', 'xag',
  ],
  GEOPOLITICS: [
    'geopolitical', 'tension', 'escalation', 'sanctions', 'diplomatic',
    'summit', 'alliance', 'nato', 'security', 'defense', 'arms',
    'nuclear', 'proliferation', 'deterrence',
  ],
  CENTRAL_BANK: [
    'central bank', 'ecb', 'boe', 'boj', 'pboe', 'rba', 'boc', 'snb',
    'reserves', 'gold reserves', 'foreign exchange', 'currency intervention',
  ],
};

const IMPACT_KEYWORDS = {
  CRITICAL_BULLISH: [
    'war', 'invasion', 'nuclear', 'missile strike', 'major escalation',
    'financial crisis', 'systemic risk', 'currency collapse',
  ],
  BULLISH: [
    'safe haven', 'geopolitical tension', 'fed dovish', 'rate cut expected',
    'inflation rising', 'recession fears', 'yield curve inversion',
    'central bank buying', 'de-dollarization',
  ],
  BEARISH: [
    'fed hawkish', 'rate hike', 'strong dollar', 'dxy surge', 'yields spike',
    'risk on', 'equity rally', 'inflation cooling', 'soft landing',
  ],
};

export function classifyItem(item: { id: string; title: string; summary: string; source: string; pubDate: number }): ClassifiedItem {
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

  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    source: item.source,
    category: topCategory as ClassifiedItem['category'],
    impact,
    label,
    keywords: [...new Set(foundKeywords)],
    pubDate: item.pubDate,
  };
}

export function classifyBatch(items: Array<{ id: string; title: string; summary: string; source: string; pubDate: number }>): ClassifiedItem[] {
  return items.map(classifyItem);
}

export function filterByImpact(items: ClassifiedItem[], minImpact: number): ClassifiedItem[] {
  return items.filter(item => item.impact >= minImpact);
}

export function getCategoryCounts(items: ClassifiedItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return counts;
}
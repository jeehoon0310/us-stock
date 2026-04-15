# Open-source tools for scraping trending US stock market news

**No single open-source project fully replicates a Bloomberg-style "most clicked" financial news feed**, but a strong solution exists by combining scraper repos with APIs that natively rank news by popularity. Most GitHub repos scrape *latest* financial headlines chronologically rather than by engagement — the "trending" ranking must come from APIs like StockNewsAPI, Marketaux, or NewsAPI.org, which offer explicit popularity/trending endpoints. Below is a curated inventory of the best tools, APIs, and tutorials to build exactly what you need.

---

## The best GitHub repos for financial news scraping

These repos represent the most capable and actively maintained open-source tools for pulling stock market headlines from major sources. None natively rank by "most clicked," but several can serve as the scraping backbone of a trending-news pipeline.

**Tier 1 — High-star, production-ready repos:**

| Repo | Stars | Language | What it does |
|------|-------|----------|-------------|
| [mariostoev/finviz](https://github.com/mariostoev/finviz) | ~1,200 | Python | Unofficial FinViz API — `get_news('AAPL')` and `get_all_news()` for market headlines, screener, insider trades. pip-installable. Actively maintained (Jan 2026). |
| [Finnhub-Stock-API/finnhub-python](https://github.com/Finnhub-Stock-API/finnhub-python) | ~720–860 | Python | Official Finnhub client — company news, market news, social sentiment scores (Reddit/Twitter mentions), analyst recommendations. Free tier: 60 calls/min. |
| [mattlisiv/newsapi-python](https://github.com/mattlisiv/newsapi-python) | ~316 | Python | Official NewsAPI.org client — **supports `sort_by="popularity"`** to rank articles by engagement. `get_top_headlines(category='business')` for top financial headlines. |
| [janlukasschroeder/realtime-newsapi](https://github.com/janlukasschroeder/realtime-newsapi) | ~296–315 | JavaScript | Real-time WebSocket streaming from 10,000+ sources including Reuters, Bloomberg, WSJ, Seeking Alpha. Part of newsfilter.io ecosystem. |
| [antirez/stonky](https://github.com/antirez/stonky) | ~256 | C | Telegram stock bot by the Redis creator — auto-generates **trending stock lists** ("tothemoon," "evenbetter," "unstoppable" categories based on momentum patterns). Uses Yahoo Finance. |

**Tier 2 — Specialized and educational repos:**

| Repo | Stars | Language | What it does |
|------|-------|----------|-------------|
| [eduardosasso/bullish](https://github.com/eduardosasso/bullish) | ~184 | Ruby | **Automated daily email newsletter** — S&P 500/Nasdaq/Dow performance, trending stocks, top gainers/losers, crypto. Bloomberg-style market snapshot format. Powers bullish.email (~1,000+ subscribers). |
| [janlukasschroeder/tipranks-api-v2](https://github.com/janlukasschroeder/tipranks-api-v2) | ~91 | JavaScript | TipRanks API wrapper — access **trending stocks**, price targets, and news sentiment ratings. |
| [nicknochnack/Stock-and-Crypto-News-ScrapingSummarizationSentiment](https://github.com/nicknochnack/Stock-and-Crypto-News-ScrapingSummarizationSentiment) | ~92 | Python | Full pipeline: scrape → summarize (Hugging Face transformers) → sentiment score. Great starting template for a headline-ranking tool. |
| [hczhu/TickerTick-API](https://github.com/hczhu/TickerTick-API) | ~50–100 | Python | **Free stock news API** (no key needed) covering ~10,000 tickers from ~10,000 sources. Powerful query language for filtering by ticker, source, story type. Rate limit: 10 req/min. |
| [je-suis-tm/web-scraping](https://github.com/je-suis-tm/web-scraping) | High | Python | Educational scrapers for Bloomberg, WSJ, Reuters, FT, BBC, CNN, Fortune, The Economist, and Reddit WallStreetBets. Each script demonstrates a unique scraping technique. |
| [oscar0812/pyfinviz](https://github.com/oscar0812/pyfinviz) | Moderate | Python | FinViz scraper with dedicated `News()` class — supports Market News, Stocks News, ETF News, Crypto News views. |
| [primus852/stock-news](https://github.com/primus852/stock-news) | Moderate | Python | Yahoo Finance RSS scraper with built-in sentiment analysis. pip-installable as `stocknews`. Simple API: `StockNews(['AAPL','MSFT']).summarize()`. |
| [samgozman/fin-thread](https://github.com/samgozman/fin-thread) | Small | TypeScript | **AI-powered autonomous Telegram news channel** — uses "Journalist" agents with RSS providers, LLM-based filtering/rewriting, and auto-publishing. Identifies affected stock tickers in each story. |
| [hgnx/automated-market-report](https://github.com/hgnx/automated-market-report) | 9 | Python | **Bloomberg-style daily PDF report generator** — aggregates Yahoo Finance, FRED, CNN, Reuters, FT, Investing.com data into market indices, top gainers/losers, economic events, and news headlines. |

**Additional scrapers for specific sources:** [willtchiu/financeSpiders](https://github.com/willtchiu/financeSpiders) (Scrapy-based, targets MarketWatch/Bloomberg/Reuters), [dwallach1/Stocker](https://github.com/dwallach1/Stocker) (Google-query-based multi-source scraper with S&P 500 ticker lists), [Ricaardo/news-scraper](https://github.com/Ricaardo/news-scraper) (Bloomberg RSS + Reuters via Google News with keyword filtering), and [weiwangchun/bbg_scraper](https://github.com/weiwangchun/bbg_scraper) (Bloomberg search results scraper using Playwright).

---

## APIs that actually rank financial news by popularity

This is where the "most clicked" / "trending" functionality lives. **Six APIs offer genuine popularity or trending ranking** — not just chronological feeds. These are the critical components for building a Bloomberg-style ranked headline tool.

**StockNewsAPI** (stocknewsapi.com) stands out as the strongest option. It has a dedicated **Trending Headlines endpoint** that filters noise and surfaces market-moving stories, an Events endpoint for high-coverage headlines, and a **`sortby=rank`** parameter using a proprietary importance algorithm. Sources include CNBC, Bloomberg, Zacks, Fox Business, and The Street. Free trial available.

**Marketaux** (marketaux.com) provides an **Entity Trending Aggregation endpoint** (`/v1/entity/trending/aggregation`) that identifies which stocks and ETFs are trending over configurable time windows (24h, 7d, custom). Each article includes `match_score` and `sentiment_score`. Covers 5,000+ sources across 80+ markets. Free tier available with no credit card.

**NewsAPI.org** remains the most widely used general news API with financial coverage. The `/v2/everything` endpoint supports **`sortBy=popularity`**, and `/v2/top-headlines` with `category=business` returns the current top US financial stories. Free developer tier allows 100 requests/day. The [mattlisiv/newsapi-python](https://github.com/mattlisiv/newsapi-python) GitHub wrapper makes integration trivial.

**NewsAPI.ai** (Event Registry) supports **`sortBy=socialScore`** to rank articles by social media shares and engagement, plus relevance-based sorting. Covers 150,000+ publishers with event detection, entity extraction, and sentiment analysis. Free tier available.

**Benzinga** offers a unique **"Why Is It Moving" (WIM)** endpoint — one-sentence explanations for price movements that effectively surface the most market-moving news. Also provides Market Movers data. A fee-free Basic tier is available through AWS Marketplace.

**Alpha Vantage** provides partial trending capability through its NEWS_SENTIMENT function, which attaches **sentiment scores** (-0.35 to 0.35) and **relevance scores** to every article. Combined with its Top Gainers & Losers endpoint, you can triangulate which news is driving markets. **25 free requests/day**.

| API | Trending sort? | Free tier | Best for |
|-----|---------------|-----------|----------|
| StockNewsAPI | ✅ `sortby=rank` + trending endpoint | Trial | Most-read financial headlines |
| Marketaux | ✅ Entity trending aggregation | ✅ Free | Identifying trending tickers in news |
| NewsAPI.org | ✅ `sortBy=popularity` | ✅ 100/day | General business top headlines |
| NewsAPI.ai | ✅ `sortBy=socialScore` | ✅ Limited | Social-engagement-ranked articles |
| Benzinga | ✅ WIM endpoint | ✅ Basic | Market-moving news explanations |
| Alpha Vantage | Partial (sentiment + relevance) | ✅ 25/day | Sentiment-ranked ticker news |

---

## Building a Bloomberg-style trending news tool: the practical approach

Since no single repo does everything, the most effective architecture combines an API with trending/popularity ranking and a formatting layer. Here is the recommended stack:

**Option A — Fastest path (API-only).** Use **NewsAPI.org** with `sortBy=popularity` and `category=business` through the `mattlisiv/newsapi-python` wrapper. This gives you ranked US business headlines in under 10 lines of Python. Add Alpha Vantage's NEWS_SENTIMENT endpoint for per-ticker sentiment scores. Format output as a ranked list with title, summary snippet, source, and URL.

**Option B — Richer data, more control.** Use **StockNewsAPI's trending endpoint** for the ranked headlines, supplement with **Marketaux's trending aggregation** to identify which tickers are dominating the news cycle, and use **mariostoev/finviz** to pull per-ticker headlines for the trending stocks. This gives you both "most important headlines" and "what's trending by ticker."

**Option C — Full scraping pipeline.** Fork [hgnx/automated-market-report](https://github.com/hgnx/automated-market-report) as your base (it already generates Bloomberg-style PDF reports from Yahoo Finance, Reuters, and FT). Add the [nicknochnack/Stock-and-Crypto-News-ScrapingSummarizationSentiment](https://github.com/nicknochnack/Stock-and-Crypto-News-ScrapingSummarizationSentiment) pipeline for headline summarization. Layer in social-engagement data from NewsAPI.ai's `socialScore` sort to rank headlines by actual popularity rather than recency.

For Telegram/Discord delivery, [samgozman/fin-thread](https://github.com/samgozman/fin-thread) (TypeScript, AI-powered autonomous Telegram channel) and [antirez/stonky](https://github.com/antirez/stonky) (C, trending stock detection) are the best starting points.

---

## Developer tutorials worth following

Several well-documented tutorials cover building financial news scrapers from scratch. The most practical are:

On **Medium**, Derek Shing's "Automated Financial News Scraper" series walks through building a Seeking Alpha scraper with SQLAlchemy database storage and AWS Lambda scheduling — the closest tutorial to a production pipeline. Vinod Dhole's "Web Scraping Yahoo! Finance" covers three distinct techniques (BeautifulSoup for static content, Selenium for dynamic pages, and embedded JSON extraction for event calendars). The GeekCulture article on scraping Google Finance Markets shows how to extract most-active stocks, gainers, and losers — useful popularity proxies.

On **dev.to**, the Crawlbase-sponsored "Scrape Yahoo Finance" tutorial produces clean JSON output from Yahoo Finance news, quotes, and reports. The ScraperAPI guide covers anti-bot bypass techniques essential for production scraping of sites like Investing.com.

A **free Udemy course** ("Web Scraping Financial News using Python 3") provides a beginner-friendly introduction to BeautifulSoup-based financial news gathering with JSON/CSV output.

The dominant library stack across all tutorials is **BeautifulSoup4 + requests** for static pages, **Playwright** (increasingly preferred over Selenium) for JavaScript-rendered content, and **Scrapy** for large-scale crawling projects.

---

## Conclusion

The critical insight from this research is that **"trending" and "most-clicked" ranking is an API-layer feature, not a scraping-layer feature**. Financial news websites rarely expose click counts or popularity metrics in their HTML — the ranking intelligence comes from APIs like StockNewsAPI (`sortby=rank`), NewsAPI.org (`sortBy=popularity`), or NewsAPI.ai (`sortBy=socialScore`). The open-source scraping repos excel at *collecting* headlines from specific sources but cannot determine which stories are most popular without an external signal.

The fastest path to a Bloomberg-style ranked headline feed is **NewsAPI.org's Python client with popularity sorting** combined with **Alpha Vantage's sentiment scoring** — achievable in under 50 lines of Python. For a more polished, automated solution, **eduardosasso/bullish** (Ruby, automated email newsletter) and **hgnx/automated-market-report** (Python, daily PDF reports) are the closest existing open-source projects to what you described, though neither ranks by click popularity. The strongest overall architecture pairs StockNewsAPI's trending endpoint with FinViz scraping for per-ticker depth, formatted through a simple Python script into a ranked headline list with title, summary, source URL, and sentiment score.
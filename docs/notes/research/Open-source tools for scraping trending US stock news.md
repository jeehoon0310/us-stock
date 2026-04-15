# Open-source tools for scraping trending US stock news

**No single dominant open-source project exists for scraping "most clicked" stock news**, but a rich ecosystem of Python libraries, APIs, and scrapers can be combined to approximate trending financial news rankings. The gap is clear: most tools fetch news chronologically by ticker rather than by popularity metrics. The best approaches combine API-based trending endpoints (Stock News API, NewsAPI.org) with community-validated Python libraries (finviz, yfinance, finnews) and custom scraping of "Most Read" sections on MarketWatch, CNBC, and Yahoo Finance. Below is a curated inventory of the **top repositories, libraries, and APIs** ranked by utility and community validation.

---

## High-star GitHub repos that scrape financial news

**yfinance** (⭐ ~14,000+ stars) is the most popular finance library on GitHub and serves as the foundation for many news-scraping projects. Maintained by Ran Aroussi at `github.com/ranaroussi/yfinance`, it wraps Yahoo Finance's API to deliver per-ticker news alongside market data. News articles include headlines, URLs, publishers, and timestamps. The limitation: it returns only ~8 articles per ticker and offers no "trending" or "most read" sorting.

```python
import yfinance as yf
ticker = yf.Ticker("AAPL")
news = ticker.news  # Returns list of recent news articles
for article in news[:3]:
    print(f"{article['title']} — {article['publisher']}")
```

**finviz** (⭐ ~1,200 stars, `github.com/mariostoev/finviz`) is the unofficial Python API for FinViz.com, which aggregates news from MarketWatch, Bloomberg, Reuters, CNBC, and Seeking Alpha. The `get_news('AAPL')` function returns timestamped headlines with source attribution, while `get_all_news()` pulls the full curated market news feed — effectively FinViz's editorially-ranked selection of important stories across **90+ data metrics per stock**.

```python
import finviz
news = finviz.get_news('AAPL')
for timestamp, headline, url, source in news[:5]:
    print(f"{timestamp} — {headline} ({source})")
all_market_news = finviz.get_all_news()  # Full curated market news feed
```

**finvizfinance** (⭐ ~600 stars, `github.com/lit26/finvizfinance`) provides an alternative FinViz wrapper returning pandas DataFrames, making it easier to filter and analyze news programmatically:

```python
from finvizfinance.news import News
fnews = News()
all_news = fnews.get_news()  # Returns dict with 'news' and 'blogs' DataFrames
print(all_news['news'].head())
```

**realtime-newsapi** (⭐ 328 stars, `github.com/janlukasschroeder/realtime-newsapi`) aggregates from **10,000+ sources** including Reuters, Bloomberg, WSJ, and Seeking Alpha via Newsfilter.io. It supports real-time WebSocket streaming and query-based article search with SDKs for Python, JavaScript, Java, and C++.

---

## The three repos closest to "most popular" news scraping

The user's core need — scraping news ranked by clicks or popularity — is poorly served by existing tools. Only three projects directly address this:

**finnews / finance-news-aggregator** (⭐ 126 stars, `github.com/areed1192/finance-news-aggregator`) is the closest match. Its CNBC client has an explicit `topic='top_news'` parameter that fetches CNBC's top/trending stories via structured RSS parsing. It also covers MarketWatch and WSJ.

```python
from finnews.client import News
news_client = News()
cnbc_client = news_client.cnbc
top_stories = cnbc_client.news_feed(topic='top_news')  # CNBC's curated top news
```

**Stocker** (⭐ 154 stars, `github.com/dwallach1/Stocker`) scrapes from 10 major sources — Bloomberg, Seeking Alpha, Reuters, CNBC, MarketWatch, Yahoo Finance, WSJ, Investopedia, TheStreet, and CNN Money. While it doesn't rank by clicks, it includes `NYSE_Top100()` and `NASDAQ_Top100()` functions to focus scraping on the most actively traded stocks and includes built-in sentiment classification.

```python
from stocker import Stocker
tickers = ['AAPL', 'GOOG', 'TSLA']
sources = ['bloomberg', 'seekingalpha', 'reuters', 'cnbc', 'marketwatch']
stocker = Stocker(tickers, sources, 'data/output.csv', 'data/links.json')
stocker.stock(flags={'date_checker': True, 'classification': True})
```

**StockTwitScrape** (`github.com/c0linburns1/StockTwitScrape`) uses Selenium to scrape Stocktwits.com's **trending section**, returning the most popular stock tickers by social engagement — a social-signal proxy for trending news.

---

## APIs that actually rank news by popularity

The API landscape is more promising than open-source repos for popularity-ranked news. **Stock News API** (stocknewsapi.com) is the strongest option, offering a dedicated **trending headlines endpoint**, an events endpoint for high-coverage stories, `sortByRank` parameter using their proprietary rank-score algorithm, and "Top Mentions" tracking (weekly/monthly/yearly). It indexes CNBC, Bloomberg, Motley Fool, and Fox Business with per-article sentiment scores.

```
GET https://stocknewsapi.com/api/v1/stat/trending?token=API_KEY
GET https://stocknewsapi.com/api/v1?tickers=TSLA&items=10&sortBy=rank&token=API_KEY
```

**NewsAPI.org** covers 150,000+ sources and provides a `sortBy=popularity` parameter on its `/everything` endpoint, ranking articles by the source's own popularity metrics. The free tier allows 100 requests/day.

```
GET https://newsapi.org/v2/everything?q=stock+market&sortBy=popularity&apiKey=API_KEY
```

**TickerTick API** (`api.tickertick.com`) stands out as a completely **free** option covering ~10,000 tickers. Its `T:curated` filter selects editorially important stories — a useful proxy for trending content:

```
GET https://api.tickertick.com/feed?q=(and T:curated tt:aapl)&n=30
```

Other notable APIs include **Marketaux** (free tier, relevance scoring), **Alpha Vantage** (sentiment-scored news, 25 free calls/day), **Finnhub** (chronological company news, 60 free calls/minute), and **NewsAPI.ai** (enterprise-grade virality/reach tracking).

---

## RSS feed aggregation and the DIY approach

For developers wanting to build their own trending-news system, RSS feeds from major financial outlets provide the raw material. **MarketWatch** publishes a "Top Stories" feed at `feeds.content.dowjones.io/public/rss/mw_topstories`, CNBC offers a Market Insider feed, and Yahoo Finance provides per-ticker RSS feeds. The `stocknews` PyPI package (`pip install stocknews`) wraps Yahoo Finance's RSS feed with automatic NLTK VADER sentiment scoring:

```python
from stocknews import StockNews
sn = StockNews(['AAPL', 'MSFT', 'NVDA'], wt_key='YOUR_KEY')
df = sn.summarize()  # Sentiment-scored news per stock per day
```

The `feedparser` + `newspaper3k` combination provides a flexible framework for parsing any financial RSS feed and extracting full article text:

```python
import feedparser, newspaper
feed = feedparser.parse('https://feeds.content.dowjones.io/public/rss/mw_topstories')
for entry in feed.entries[:5]:
    article = newspaper.Article(entry.link)
    article.download(); article.parse()
    print(f"{article.title} — {article.publish_date}")
```

A particularly valuable Towards Data Science article ("Extract Trending Stories in News") demonstrates a full NLP pipeline for **clustering financial news and detecting trending stories** using Spacy NER, TF-IDF weighting, and temporal analysis across 30,000+ headlines from Reuters, CNBC, and The Guardian. This is the most sophisticated open-source approach to identifying genuinely "trending" stories rather than simply "recent" ones.

---

## Korean-language resources for US stock news crawling

Several Korean-language projects address 미국 주식 뉴스 크롤링. **telegram-stock-info-noti-bot** (`github.com/liante0904/telegram-stock-info-noti-bot`) is notable for explicitly crawling **"가장 많이 본 뉴스" (most viewed/popular news)** from Naver Finance — one of the few projects anywhere that directly targets popularity-ranked financial news. It also crawls US research reports (Stifel), 52-week high/low lists, and sends results via Telegram with SQLite/Oracle storage.

**quant_py** (`github.com/hyunyulhenry/quant_py`) provides comprehensive Korean tutorials on crawling global stock data including US markets via yfinance, with chapters covering financial statements, valuation metrics, and database storage. **stock-news-summary** (`github.com/myeonghak/stock-news-summary`) crawls Naver Finance news and summarizes articles using KoBART (Korean BART), designed for Google Colab deployment.

---

## Recommended architecture for a trending stock news scraper

| Layer | Recommended Tool | Purpose |
|-------|-----------------|---------|
| Trending API | Stock News API or NewsAPI.org | Popularity-ranked headlines |
| Per-ticker news | finviz + yfinance | Deep coverage per stock |
| RSS aggregation | finnews + feedparser | CNBC/MarketWatch/WSJ top stories |
| Custom scraping | BeautifulSoup + Selenium | MarketWatch "Most Read" section |
| Sentiment scoring | NLTK VADER or finvizfinance | Filter by sentiment intensity |
| Trend detection | Spacy + TF-IDF clustering | Identify emerging story clusters |

The most practical path for a developer today combines **Stock News API's trending endpoint** (for pre-computed popularity rankings) with **finviz's curated news feed** (for editorially selected important stories) and **finnews's CNBC `top_news` parameter** (for broadcast-ranked stories). For fully open-source solutions without API keys, scraping MarketWatch's "Most Read" sidebar and CNBC's "Trending Now" section with BeautifulSoup remains the most direct — if fragile — approach to capturing genuine click-ranked stock news.

## Conclusion

The open-source ecosystem for stock news scraping is mature for *chronological* per-ticker news but immature for *popularity-ranked* news. **finviz** (~1,200 stars) and **yfinance** (~14,000 stars) dominate the library landscape. **Stock News API** and **NewsAPI.org** are the only tools offering true popularity sorting via API. The Korean-language **telegram-stock-info-noti-bot** is uniquely positioned as the only project explicitly targeting "most viewed" news. For developers building a trending stock news system, the most effective strategy combines an API with popularity ranking (Stock News API), a curated feed library (finviz/finnews), and NLP-based trend detection (TF-IDF clustering) — no single tool solves the full problem alone.
import express from 'express';
import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createGeminiRateLimiter } from './lib/geminiRateLimiter.js';

dotenv.config();

// --- Supabase client 初期化 ---
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
} else {
  console.warn('Supabase 未設定: SUPABASE_URL / SUPABASE_SERVICE_KEY が見つかりません。curation 保存は無効になります。');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'db_articles.json');
const ARTICLE_TTL_HOURS = 48; // 過去48時間分を保持
const geminiRateLimiter = createGeminiRateLimiter(4);

let rawArticlesCache = [];

// 蓄積記事の読み込み
function loadArticles() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      const loaded = JSON.parse(data);
      rawArticlesCache = loaded; // 初期ロード
      return loaded;
    }
  } catch (err) {
    console.error('データベースの読み込み失敗:', err.message);
  }
  return [];
}

// 蓄積記事の保存
function saveArticles(articles) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(articles, null, 2), 'utf-8');
    rawArticlesCache = articles; // メモリキャッシュも最新に更新
  } catch (err) {
    console.error('データベースの保存失敗:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
});

// 静的ファイルの配信ディレクトリを設定
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 初期 RSS フィードのリスト（feeds.json が存在しない場合のデフォルト値）
const DEFAULT_FEEDS = {
  headline: [
    { name: 'NHK主要ニュース', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', weight: 10 }
  ],
  general: [
    { name: 'NHK社会ニュース', url: 'https://www3.nhk.or.jp/rss/news/cat2.xml', weight: 8 },
    { name: 'NHK経済ニュース', url: 'https://www3.nhk.or.jp/rss/news/cat5.xml', weight: 7 },
    { name: 'BBCニュース（日本・国際）', url: 'https://feeds.bbci.co.uk/japanese/rss.xml', weight: 7 },
    { name: '毎日新聞ニュース', url: 'https://mainichi.jp/rss/etc/mainichi-flash.rss', weight: 6 },
    { name: '朝日新聞ニュース', url: 'https://www.asahi.com/rss/asahi/newsheadlines.rdf', weight: 6 },
    { name: '東洋経済オンライン', url: 'https://toyokeizai.net/list/feed/rss', weight: 6 },
    { name: 'ダイヤモンド・オンライン', url: 'https://diamond.jp/list/feed/rss', weight: 6 }
  ],
  tech: [
    { name: 'ITmedia NEWS', url: 'https://rss.itmedia.co.jp/rss/2.0/news.xml', weight: 6 },
    { name: '＠IT（アットマーク・アイティ）', url: 'https://rss.itmedia.co.jp/rss/2.0/atit.xml', weight: 6 },
    { name: 'Publickey', url: 'https://www.publickey1.jp/atom.xml', weight: 6 },
    { name: 'Qiita（トレンド）', url: 'https://qiita.com/popular-items/feed.atom', weight: 6 },
    { name: 'Zenn（トレンド）', url: 'https://zenn.dev/feed', weight: 6 }
  ],
  trending: [
    { name: 'ねとらぼ', url: 'https://rss.itmedia.co.jp/rss/2.0/netlab.xml', weight: 5 },
    { name: 'ギズモード・ジャパン', url: 'https://www.gizmodo.jp/index.xml', weight: 5 },
    { name: 'GIGAZINE', url: 'https://gigazine.net/news/rss_2.0/', weight: 5 },
    { name: 'Impress Watch', url: 'https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf', weight: 5 },
    { name: 'ライフハッカー・ジャパン', url: 'https://www.lifehacker.jp/index.xml', weight: 5 },
    { name: 'PC Watch', url: 'https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf', weight: 5 },
    { name: 'ケータイ Watch', url: 'https://k-tai.watch.impress.co.jp/data/rss/1.0/ktw/feed.rdf', weight: 5 }
  ],
  sports: [
    { name: 'NHKスポーツ', url: 'https://www3.nhk.or.jp/rss/news/cat7.xml', weight: 5 },
    { name: '毎日新聞スポーツ', url: 'https://mainichi.jp/rss/etc/mainichi-sports.rss', weight: 5 }
  ]
};

const FEEDS_FILE = path.join(__dirname, 'feeds.json');
let FEEDS = {};

function loadFeeds() {
  try {
    if (fs.existsSync(FEEDS_FILE)) {
      FEEDS = JSON.parse(fs.readFileSync(FEEDS_FILE, 'utf8'));
      console.log('feeds.json からフィードリストを正常にロードしました。');
    } else {
      FEEDS = JSON.parse(JSON.stringify(DEFAULT_FEEDS));
      fs.writeFileSync(FEEDS_FILE, JSON.stringify(FEEDS, null, 2), 'utf8');
      console.log('デフォルトのフィードリストで feeds.json を作成しました。');
    }
  } catch (err) {
    console.error('フィードリストのロード中にエラーが発生しました:', err);
    FEEDS = JSON.parse(JSON.stringify(DEFAULT_FEEDS));
  }
}

function saveFeeds() {
  try {
    fs.writeFileSync(FEEDS_FILE, JSON.stringify(FEEDS, null, 2), 'utf8');
    console.log('feeds.json を正常に更新・保存しました。');
  } catch (err) {
    console.error('フィードリストの保存中にエラーが発生しました:', err);
  }
}

// フィード初期ロード
loadFeeds();

const TIMELINE_FILE = path.join(__dirname, 'timeline_archive.json');

function loadTimelineArchive() {
  try {
    if (fs.existsSync(TIMELINE_FILE)) {
      return JSON.parse(fs.readFileSync(TIMELINE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('timeline_archive.jsonの読み込み中にエラーが発生しました:', err);
  }
  return [];
}

function saveTimelineArchive(data) {
  try {
    fs.writeFileSync(TIMELINE_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('timeline_archive.jsonを保存しました。');
  } catch (err) {
    console.error('timeline_archive.jsonの保存中にエラーが発生しました:', err);
  }
}

// 注目スコア70以上のニュースを抽出して過去30日間のタイムラインアーカイブに統合する
function archiveImportantNews(curatedList = [], topNewsList = []) {
  console.log('--- タイムラインアーカイブ処理開始 ---');
  let archive = loadTimelineArchive();
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30日

  // 1. 重大ニュースの抽出
  const candidates = [];

  // キュレーションニュースから抽出
  curatedList.forEach(item => {
    if (Number(item.score) >= 70) {
      candidates.push({
        title: item.title,
        summary: item.summary,
        url: item.link || (item.metadata?.sources?.[0]?.url) || '#',
        pubDate: item.pubDate || new Date().toISOString(),
        score: Number(item.score),
        category: item.category || 'ニュース',
        publisher: item.feed_name || (item.metadata?.sources?.[0]?.publisher) || 'ニュースソース',
        sources: item.metadata?.sources || []
      });
    }
  });

  // 一般ニュース（topNews）から抽出
  topNewsList.forEach(item => {
    if (Number(item.score) >= 70) {
      candidates.push({
        title: item.aiTitle || item.title,
        summary: item.aiSummary || item.summary,
        url: item.link || (item.sources?.[0]?.url) || '#',
        pubDate: item.pubDate || new Date().toISOString(),
        score: Number(item.score),
        category: '一般',
        publisher: item.publisher || (item.sources?.[0]?.publisher) || 'ニュースソース',
        sources: item.sources || []
      });
    }
  });

  // 2. マージと重複排除（URL またはタイトルで同一視）
  candidates.forEach(candidate => {
    if (candidate.url === '#') return;
    
    const isDuplicate = archive.some(existing => 
      existing.url === candidate.url || 
      existing.title.trim() === candidate.title.trim()
    );

    if (!isDuplicate) {
      archive.push(candidate);
      console.log(`新規アーカイブ追加: 「${candidate.title}」 (Score: ${candidate.score})`);
    }
  });

  // 3. 30日より古いもののクリーンアップ
  const beforeCount = archive.length;
  archive = archive.filter(item => {
    const pubTime = new Date(item.pubDate).getTime();
    return pubTime >= thirtyDaysAgo;
  });
  const afterCount = archive.length;
  if (beforeCount !== afterCount) {
    console.log(`タイムラインアーカイブのTTLクリーンアップ: ${beforeCount - afterCount}件の古い記事を削除しました。`);
  }

  // 4. 時系列（新しい順）に並び替えて保存
  archive.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  saveTimelineArchive(archive);
  console.log(`--- タイムラインアーカイブ処理完了 (合計: ${archive.length}件) ---`);
}

// XML構造破損やAtomフォーマット対策のフォールバック用正規表現RSSパーサー
function parseRssRegex(xml) {
  const items = [];
  const itemRegex = /<(item|entry)[\s>][\s\S]*?<\/\1>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[0];
    
    // タイトルの抽出
    const titleMatch = content.match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
    let title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
    // HTMLエンティティデコード（簡易）
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // リンクの抽出
    let link = '';
    const linkMatch = content.match(/<link>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i);
    if (linkMatch) {
      link = (linkMatch[1] || linkMatch[2] || '').trim();
    } else {
      const hrefMatch = content.match(/<link\s+[^>]*?href=["']([^"']+)["']/i);
      if (hrefMatch) link = hrefMatch[1].trim();
    }
    
    // 日付の抽出
    const dateMatch = content.match(/<(pubDate|dc:date|published|updated)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/i);
    const pubDate = dateMatch ? (dateMatch[2] || dateMatch[3] || '').trim() : new Date().toISOString();
    
    // 概要の抽出
    const descMatch = content.match(/<(description|summary|content)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/i);
    const contentSnippet = descMatch ? (descMatch[2] || descMatch[3] || '').trim().replace(/<[^>]+>/g, '').substring(0, 200) : '';

    // 画像の抽出 (media:content, media:thumbnail, enclosure, img tag)
    let imageUrl = '';
    const mediaContentMatch = content.match(/<media:content[^>]*?url=["']([^"']+)["']/i);
    const mediaThumbnailMatch = content.match(/<media:thumbnail[^>]*?url=["']([^"']+)["']/i);
    const enclosureImageMatch = content.match(/<enclosure[^>]*?type=["']image\/[^"']+["'][^>]*?url=["']([^"']+)["']/i) || content.match(/<enclosure[^>]*?url=["']([^"']+)["'][^>]*?type=["']image\/[^"']+["']/i);
    const imgTagMatch = content.match(/<img[^>]*?src=["']([^"']+)["']/i);

    if (mediaContentMatch) {
      imageUrl = mediaContentMatch[1].trim();
    } else if (mediaThumbnailMatch) {
      imageUrl = mediaThumbnailMatch[1].trim();
    } else if (enclosureImageMatch) {
      imageUrl = enclosureImageMatch[1].trim();
    } else if (imgTagMatch) {
      imageUrl = imgTagMatch[1].trim();
    }

    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        contentSnippet,
        image: imageUrl
      });
    }
  }
  
  return { items };
}

// サイト名などのノイズを除去するクレンジング関数
function cleanArticleTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s*\|\s*東洋経済オンライン.*$/i, '')
    .replace(/\s*-\s*毎日新聞.*$/i, '')
    .replace(/\s*（毎日新聞）.*$/i, '')
    .replace(/\s*-\s*朝日新聞デジタル.*$/i, '')
    .replace(/\s*：朝日新聞デジタル.*$/i, '')
    .replace(/\s*：朝日新聞.*$/i, '')
    .replace(/\s*\|\s*ギズモード・ジャパン.*$/i, '')
    .replace(/\s*\|\s*Gizmodo Japan.*$/i, '')
    .replace(/\s*-\s*ねとらぼ.*$/i, '')
    .replace(/\s*-\s*ITmedia.*$/i, '')
    .replace(/\s*-\s*Watch\s*Impress.*$/i, '')
    .replace(/\s*-\s*Impress\s*Watch.*$/i, '')
    .replace(/\s*\[GIGAZINE\].*$/i, '')
    .trim();
}

// 単語の抽出と簡易的なストップワード定義
const STOP_WORDS = new Set([
  'ニュース', '開始', '発表', '決定', '開催', '最新', '公開', '日本', '世界',
  '予定', '提供', '登場', '話題', '人気', '本日', '昨日', '明日', '場合', '方法',
  '情報', '紹介', 'サービス', '機能', '追加', '実施', '対応', '対応開始', '公式'
]);

function extractKeywords(title) {
  if (!title) return [];
  // 漢字、カタカナ、英数字の連続を単語として抽出
  const matches = title.match(/[a-zA-Z0-9\u4e00-\u9faf\u30a0-\u30ff]{2,}/g) || [];
  return matches.filter(word => !STOP_WORDS.has(word));
}

function extractNumbers(title) {
  if (!title) return [];
  // タイトルから数字（1桁以上）を抽出
  return title.match(/\d+/g) || [];
}

// 2つの記事が同じトピックか類似度判定 (数値の一致チェック、Jaccard、およびOverlap類似度)
function areSimilar(art1, art2) {
  const k1 = art1.keywords;
  const k2 = art2.keywords;
  if (k1.length === 0 || k2.length === 0) return false;

  // タイトルに含まれる数字の抽出と不一致チェック
  const n1 = extractNumbers(art1.title);
  const n2 = extractNumbers(art2.title);
  
  // 双方に数字が含まれていて、共通する数字が1つもない場合は別の出来事とみなす (例: 台風7号と8号の混ざり防止)
  if (n1.length > 0 && n2.length > 0) {
    const hasCommonNumber = n1.some(num => n2.includes(num));
    if (!hasCommonNumber) return false;
  }

  // 共通の単語数をカウント
  const intersection = k1.filter(w => k2.includes(w));
  if (intersection.length === 0) return false;
  
  // Jaccard類似度 (共通語 / 総ユニーク語)
  const union = Array.from(new Set([...k1, ...k2]));
  const jaccard = intersection.length / union.length;
  
  // オーバーラップ係数 (共通語 / 少ない方の語数) - 短いタイトルと長いタイトルの類似判定に有効
  const overlap = intersection.length / Math.min(k1.length, k2.length);
  
  // 5文字以上の強力な共通キーワード一致、かつ共通単語数が2つ以上の場合もマージ
  const hasVeryLongMatch = intersection.some(w => w.length >= 5);

  // 特徴的なキーワード（数字を含む3文字以上の語、または5文字以上の語）が1つでも完全に一致している場合の特別ルール
  const hasStrongSingleMatch = intersection.some(w => {
    // 数字を含んでいる（例: 台風7号, 26日など）で3文字以上
    if (/\d/.test(w) && w.length >= 3) return true;
    // 5文字以上の長い固有の単語
    if (w.length >= 5) return true;
    return false;
  });

  // 共通語が2つ以上、かつ類似度が一定以上の場合は同じトピックとみなす
  return (intersection.length >= 2 && (jaccard >= 0.25 || overlap >= 0.55)) ||
         (hasVeryLongMatch && intersection.length >= 2) ||
         hasStrongSingleMatch;
}

// 収集した記事のクラスタリング
function clusterArticles(articles) {
  const clusters = [];

  for (const article of articles) {
    let added = false;
    for (const cluster of clusters) {
      // クラスターの最初の記事（または代表記事）と比較
      if (areSimilar(cluster.articles[0], article)) {
        cluster.articles.push(article);
        // クラスター内の記事を公開日時の最新順にソートして、最新ソースを代表にする
        cluster.articles.sort((a, b) => {
          const tA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
          const tB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
          return tB - tA;
        });
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({
        id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        keywords: [...article.keywords],
        articles: [article]
      });
    }
  }
  return clusters;
}

// クラスターを最新記事の公開日時（降順）でソートするヘルパー
function sortClustersByDate(clusters) {
  return clusters.sort((a, b) => {
    const getLatestDate = (cluster) => {
      const dates = cluster.articles.map(art => {
        const d = art.pubDate ? new Date(art.pubDate).getTime() : 0;
        return isNaN(d) ? 0 : d;
      });
      return dates.length > 0 ? Math.max(...dates) : 0;
    };
    return getLatestDate(b) - getLatestDate(a);
  });
}

// クラスターを重要度スコア（最大ウェイト × 時間減衰）でソートするヘルパー
function sortClustersByScore(clusters) {
  const now = Date.now();
  return clusters.sort((a, b) => {
    const getClusterScore = (cluster) => {
      const maxWeight = Math.max(...cluster.articles.map(art => art.weight || 5));
      const latestTime = Math.max(...cluster.articles.map(art => art.pubDate ? new Date(art.pubDate).getTime() : 0));
      
      // 時間減衰: 12時間（半減期）の指数減衰
      const ageHours = (now - latestTime) / (3600 * 1000);
      const timeDecay = Math.pow(0.5, Math.max(0, ageHours) / 12);
      
      // 同一話題を複数メディアが報じている場合は信頼性の向上として加点 (最大 1.5倍)
      const sourceBoost = Math.min(1.5, 1 + (cluster.articles.length - 1) * 0.15);
      
      return maxWeight * timeDecay * sourceBoost;
    };
    return getClusterScore(b) - getClusterScore(a);
  });
}

// HTMLエンティティのデコード
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, String.fromCharCode(96))
    .replace(/&#x3D;/g, '=');
}

// 記事のURLからメタ情報（説明文）を自動的にクロールして抽出
// 記事URLから抽出された画像のメモリキャッシュ
const articleImageCache = {};

async function fetchArticleSummaryFromUrl(url) {
  if (!url) return '';
  
  // ダミーリンク、またはRSSのインデックスページ、特定の不適合なソースはスキップ
  if (url.startsWith('mock_') || url.includes('toyokeizai.net/articles') || url.includes('mainichi.jp/rss') || url.includes('nikkei.com/RSS')) {
    return '';
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒タイムアウト

    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    if (!res.ok) return '';

    const html = await res.text();

    // og:image (OGP画像) の抽出とキャッシュ
    const ogImageMatch = html.match(/<meta\s+[^>]*property=["']og:image["']\s+[^>]*content=["'](.*?)["']/i) ||
                         html.match(/<meta\s+[^>]*content=["'](.*?)["']\s+[^>]*property=["']og:image["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      const imgUrl = ogImageMatch[1].trim();
      // 相対パスの場合は絶対URLに直す（簡易対応）
      if (imgUrl.startsWith('//')) {
        articleImageCache[url] = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        try {
          const parsed = new URL(url);
          articleImageCache[url] = parsed.origin + imgUrl;
        } catch (e) {
          articleImageCache[url] = imgUrl;
        }
      } else if (imgUrl.startsWith('http')) {
        articleImageCache[url] = imgUrl;
      }
    }

    // 1. og:description の抽出
    let match = html.match(/<meta\s+[^>]*property=["']og:description["']\s+[^>]*content=["'](.*?)["']/i) ||
                html.match(/<meta\s+[^>]*content=["'](.*?)["']\s+[^>]*property=["']og:description["']/i);
    if (match && match[1]) {
      const desc = decodeHtmlEntities(match[1].trim());
      if (desc.length > 5) return desc;
    }

    // 2. description の抽出
    match = html.match(/<meta\s+[^>]*name=["']description["']\s+[^>]*content=["'](.*?)["']/i) ||
            html.match(/<meta\s+[^>]*content=["'](.*?)["']\s+[^>]*name=["']description["']/i);
    if (match && match[1]) {
      const desc = decodeHtmlEntities(match[1].trim());
      if (desc.length > 5) return desc;
    }

    // 3. bodyのテキストから冒頭リードを抽出
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      let bodyText = bodyMatch[1]
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      bodyText = decodeHtmlEntities(bodyText);
      if (bodyText.length > 150) {
        return bodyText.substring(0, 150) + '...';
      }
      if (bodyText.length > 10) {
        return bodyText;
      }
    }

    return '';
  } catch (err) {
    console.warn(`[Summary Crawler] クロール失敗 (${url}):`, err.message);
    return '';
  }
}

// はてなブックマーク数の取得（実API）
async function fetchHatenaCount(url) {
  try {
    const response = await fetch(`https://bookmark.hatenaapis.com/count/entry?url=${encodeURIComponent(url)}`);
    if (!response.ok) return 0;
    const text = await response.text();
    const count = parseInt(text, 10);
    return isNaN(count) ? 0 : count;
  } catch (e) {
    return 0;
  }
}

// 感情判定ロジック
function detectEmotion(title, summary, shareCount) {
  const t = (title + ' ' + summary).toLowerCase();
  
  if (t.match(/(驚き|衝撃|初|意外|まさか|逮捕|急転|急遽|突如|発覚|発信|巨大)/)) {
    return 'surprised'; // 😲 驚き
  }
  if (t.match(/(面白い|笑|爆笑|珍|ユニーク|パロディ|ユーモア|楽しい|魅力)/)) {
    return 'funny'; // 😂 面白い
  }
  if (t.match(/(悲しい|死亡|事故|死去|遺体|火災|衝突|怪我|被害|懸念|不調|中止|中止発表|破綻|倒産|犠牲)/)) {
    return 'sad'; // 😢 懸念・悲報
  }
  if (t.match(/(賛成|共感|感動|素晴らしい|支持|貢献|感謝|納得|選出|推奨|称賛|絶賛)/)) {
    return 'approved'; // 👍 賛同
  }
  
  // 拡散数が多くて特定の感情に偏らない場合は大注目
  if (shareCount > 150) {
    return 'hot'; // 🔥 大注目
  }
  
  // デフォルト
  const emotions = ['hot', 'approved', 'surprised'];
  return emotions[Math.floor(Math.random() * emotions.length)];
}

// サーキットブレーカー用の状態フラグ
let isQuotaExceeded = false;

// AI機能の使用有無フラグ（APIクォータ制限の回避のためデフォルトでfalseに設定）
const USE_AI = false;
// Gemini は「記事生成」だけに限定し、それ以外のタイトル/要約生成は常にフォールバックにする
const GEMINI_ARTICLE_GENERATION_ONLY = process.env.GEMINI_ARTICLE_GENERATION_ONLY !== 'false';

// アルゴリズムによる代表タイトルと概要の選定 (非AIスコアリング方式)
function selectRepresentativeTitleAndSummary(cluster) {
  const articles = cluster.articles;
  if (articles.length === 1) {
    const art = articles[0];
    return {
      title: art.title.split('──')[0].split(' - ')[0].trim(),
      summary: (art.contentSnippet || '詳細記事を参照してください。').slice(0, 100) + ((art.contentSnippet || '').length > 100 ? '...' : '')
    };
  }

  // 1. すべてのキーワードの出現頻度を計算
  const wordFreq = {};
  for (const art of articles) {
    for (const word of art.keywords) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }

  // 2. 各記事タイトルのスコアリング
  let bestTitle = '';
  let highestTitleScore = -1;

  for (const art of articles) {
    const title = art.title.split('──')[0].split(' - ')[0].trim();
    let score = 0;

    // A. 共通キーワードのスコア（他の記事で多く出現する単語を含んでいるほど高スコア）
    const titleKeywords = art.keywords;
    for (const word of titleKeywords) {
      if (wordFreq[word]) {
        score += wordFreq[word] * 2.0; // キーワード一致の重みを大きく
      }
    }

    // B. 客観的なニュースソースの優先（NHKニュースの見出しは簡潔で客観的）
    if (art.feedName.includes('NHK')) {
      score += 5;
    }

    // C. タイトルの長さ（30〜45文字程度がニュースの見出しとして最適）
    const len = title.length;
    if (len >= 30 && len <= 48) {
      score += 10;
    } else if (len >= 20 && len < 30) {
      score += 5;
    } else if (len > 48) {
      score -= (len - 48) * 0.5; // 長すぎるものは減点
    }

    if (score > highestTitleScore) {
      highestTitleScore = score;
      bestTitle = title;
    }
  }

  // 3. 各記事概要（要約）のスコアリング
  let bestSummary = '';
  let highestSummaryScore = -1;

  for (const art of articles) {
    const rawSummary = art.contentSnippet || '';
    // 定型文やノイズの除去
    const cleanSummary = rawSummary.replace(/続きを読む.*/g, '').replace(/https?:\/\/\S+/g, '').trim();
    if (cleanSummary.length === 0) continue;

    let score = 0;

    // A. 概要の長さ（80〜130文字程度が最適）
    const len = cleanSummary.length;
    if (len >= 80 && len <= 130) {
      score += 10;
    } else if (len > 50 && len < 80) {
      score += 5;
    }

    // B. NHKなどの要約はまとまっているため加点
    if (art.feedName.includes('NHK')) {
      score += 10;
    }

    if (score > highestSummaryScore) {
      highestSummaryScore = score;
      bestSummary = cleanSummary.slice(0, 120) + (cleanSummary.length > 120 ? '...' : '');
    }
  }

  // もし適切な概要が見つからなかった場合のフォールバック
  if (!bestSummary) {
    const longestArt = articles.reduce((longest, current) => (current.contentSnippet || '').length > (longest.contentSnippet || '').length ? current : longest, articles[0]);
    const summary = longestArt.contentSnippet || '詳細記事を参照してください。';
    bestSummary = summary.slice(0, 100) + (summary.length > 100 ? '...' : '');
  }

  return {
    title: bestTitle,
    summary: bestSummary
  };
}

// AIによる共通タイトル・概要の生成 (Gemini API または フォールバック)
async function generateAITitleAndSummary(cluster) {
  const fallbackTitle = cluster.articles.reduce((longest, current) => current.title.length > longest.title.length ? current : longest, cluster.articles[0]).title;
  const fallbackSummary = cluster.articles.reduce((longest, current) => (current.contentSnippet || '').length > (longest.contentSnippet || '').length ? current : longest, cluster.articles[0]).contentSnippet || '詳細記事を参照してください。';

  // すでにクォータ超過を検知している場合は即座にフォールバック（無駄なAPIコールとディレイをスキップ）
  if (isQuotaExceeded || GEMINI_ARTICLE_GENERATION_ONLY) {
    return {
      title: fallbackTitle.split('──')[0].split(' - ')[0].trim(),
      summary: fallbackSummary.slice(0, 100) + (fallbackSummary.length > 100 ? '...' : '')
    };
  }

  // 無料枠のレート制限に合わせて、同時に大量に送らないようにする
  await geminiRateLimiter.waitForSlot();

  const apiKey = process.env.GEMINI_API_KEY;
  const headlines = cluster.articles.map(a => `- ${a.title}`).join('\n');

  if (!apiKey) {
    // APIキーがない場合のフォールバック（代表記事の見出し・概要を加工）
    return {
      title: fallbackTitle.split('──')[0].split(' - ')[0].trim(),
      summary: fallbackSummary.slice(0, 100) + (fallbackSummary.length > 100 ? '...' : '')
    };
  }

  try {
    const prompt = `以下のニュース見出し群は、同じ出来事に関する報道です。これらを集約した、中立的で分かりやすい「共通タイトル」（日本語、30文字程度）と、「出来事の概要」（日本語、1文で60文字程度）を作成し、以下のJSONフォーマットのみで出力してください。Markdown表記や説明文は含めないでください。

JSONフォーマット:
{
  "title": "生成した共通タイトル",
  "summary": "生成した概要文"
}

見出し群:
${headlines}`;

    let response;
    let retries = 4;
    let delay = 10000; // 初期リトライ遅延: 10秒
    let lastErrorText = ''; // エラーテキスト保持用

    while (retries > 0) {
      console.log(`AI生成リクエスト送信中... (残リトライ: ${retries - 1})`);
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      
      if (response.status === 429) {
        // クォータ超過時はサーキットブレーカーをオンにして即座に終了（これ以上のリトライやAPIコールをしない）
        isQuotaExceeded = true;
        lastErrorText = await response.text();
        console.warn(`Gemini API 429 Quota Exceeded. Circuit breaker activated.`);
        console.warn(`API Error Detail: ${lastErrorText.slice(0, 300)}`);
        break;
      }

      if (response.status === 503) {
        retries--;
        console.warn(`Gemini API returned 503. Retrying in ${delay / 1000} seconds... (${retries} retries left)`);
        lastErrorText = await response.text();
        console.warn(`API Error Detail: ${lastErrorText.slice(0, 300)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // 指数バックオフ
        continue;
      }
      break;
    }

    if (!response.ok) {
      const errorText = lastErrorText || await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    const resultJson = JSON.parse(resultText.trim());
    return {
      title: resultJson.title,
      summary: resultJson.summary
    };
  } catch (e) {
    console.error('AI Title Generation failed, falling back:', e.message);
    return {
      title: fallbackTitle.split('──')[0].split(' - ')[0].trim(),
      summary: fallbackSummary.slice(0, 100) + (fallbackSummary.length > 100 ? '...' : '')
    };
  }
}

// --- スポーツ試合状況（スコアボード）シミュレータ ---
let sportsGamesState = null;

// プロ野球・MLB・サッカーの対戦カード定義と初期化
function initSportsGames() {
  sportsGamesState = [
    {
      id: 'game_npb_1',
      type: 'baseball', // プロ野球
      home: '巨人',
      away: '阪神',
      homeScore: 0,
      awayScore: 0,
      status: 'scheduled',
      detail: '18:00開始予定',
      commentary: '予告先発：戸郷（巨人）、才木（阪神）',
      progress: 0
    },
    {
      id: 'game_npb_2',
      type: 'baseball', // プロ野球
      home: 'ソフトバンク',
      away: 'オリックス',
      homeScore: 0,
      awayScore: 0,
      status: 'scheduled',
      detail: '18:00開始予定',
      commentary: '予告先発：有原（ソ）、宮城（オ）',
      progress: 0
    },
    {
      id: 'game_mlb_1',
      type: 'mlb', // MLB
      home: 'ドジャース',
      away: 'パドレス',
      homeScore: 0,
      awayScore: 0,
      status: 'scheduled',
      detail: '10:10開始予定',
      commentary: 'ドジャース大谷は「2番・DH」で先発予定',
      progress: 0
    },
    {
      id: 'game_soccer_1',
      type: 'soccer', // サッカー
      home: '川崎フロンターレ',
      away: '浦和レッズ',
      homeScore: 0,
      awayScore: 0,
      status: 'scheduled',
      detail: '19:00開始予定',
      commentary: '等々力陸上競技場にて本日19:00キックオフ',
      progress: 0
    }
  ];
}

// 各スポーツ実況のランダムコメント候補
const BASEBALL_COMMENTARIES = [
  '両者無得点のまま静かな立ち上がり',
  'ランナーを出すも後続が断たれ無得点',
  'ホームランで先制点をあげる！',
  'タイムリーヒットで1点追加！',
  '満塁の大チャンスを迎えるも三振に倒れる',
  'ダブルプレーでピンチを脱出',
  'エラーからピンチが広がるもなんとか無失点',
  '大谷が特大のソロホームランを放つ！',
  'タイムリーツーベースで勝ち越しに成功！',
  'ピッチャー交代。緊迫した場面での救援登板',
  'ファインプレーでスタジアムが大歓声に包まれる',
  'ピッチャーが好投を見せ、相手打線を三者凡退に抑える'
];

const SOCCER_COMMENTARIES = [
  'キックオフ！前半から激しい競り合いが続く',
  'ミドルシュートを放つも、キーパーのファインセーブに阻まれる',
  'コーナーキックから頭で合わせるもゴール枠外へ',
  '鮮やかな連携からゴール前へ迫るも、ディフェンスに阻まれる',
  '相手ディフェンスの隙を突き、見事なシュートで先制！',
  'イエローカードが提示され、スタジアムに緊張が走る',
  '選手交代。攻撃陣を投入して勝負に出る',
  'PKを獲得！落ち着いて沈めて追加点をあげる！',
  'カウンターから決定的なチャンスを迎えるもゴールならず',
  '後半アディショナルタイムに突入、緊迫した展開が続く'
];

// 試合状況の進行処理
function progressSportsGames() {
  if (!sportsGamesState) {
    initSportsGames();
    return;
  }

  for (const game of sportsGamesState) {
    if (game.status === 'finished') {
      continue;
    }

    if (game.status === 'scheduled') {
      // 40%の確率で試合開始 (LIVE) に移行
      if (Math.random() < 0.4) {
        game.status = 'live';
        game.progress = 1;
        if (game.type === 'soccer') {
          game.detail = '前半5分';
          game.commentary = 'キックオフ！両チーム主導権争いが続きます。';
        } else {
          game.detail = '1回表';
          game.commentary = 'プレイボール！試合開始です。';
        }
      }
      continue;
    }

    if (game.status === 'live') {
      game.progress += 1;
      
      // 野球 (progress 1〜18, 1回表〜9回裏)
      if (game.type === 'baseball' || game.type === 'mlb') {
        const innings = ['1回', '2回', '3回', '4回', '5回', '6回', '7回', '8回', '9回'];
        const inningIndex = Math.floor((game.progress - 1) / 2);
        const isBottom = game.progress % 2 === 0;
        
        if (inningIndex < 9) {
          game.detail = `${innings[inningIndex]}${isBottom ? '裏' : '表'}`;
          
          // 30%の確率で得点が入る
          if (Math.random() < 0.3) {
            const points = Math.random() < 0.8 ? 1 : (Math.random() < 0.8 ? 2 : 3);
            const isHomeScoring = isBottom ? true : (Math.random() < 0.5);
            if (isHomeScoring) {
              game.homeScore += points;
              game.commentary = `${game.home}が${points}点獲得！ ${BASEBALL_COMMENTARIES[Math.floor(Math.random() * BASEBALL_COMMENTARIES.length)]}`;
            } else {
              game.awayScore += points;
              game.commentary = `${game.away}が${points}点獲得！ ${BASEBALL_COMMENTARIES[Math.floor(Math.random() * BASEBALL_COMMENTARIES.length)]}`;
            }
          } else {
            // 得点なしの解説
            game.commentary = BASEBALL_COMMENTARIES[Math.floor(Math.random() * BASEBALL_COMMENTARIES.length)];
          }
        }
        
        // 9回裏終了（progress=18）またはそれ以降で終了
        if (game.progress >= 18) {
          game.status = 'finished';
          game.detail = '試合終了';
          game.commentary = `試合終了！【${game.away} ${game.awayScore} - ${game.homeScore} ${game.home}】`;
        }
      } 
      // サッカー (progress 1〜9)
      else if (game.type === 'soccer') {
        const timeMinutes = game.progress * 10;
        if (game.progress <= 4) {
          game.detail = `前半${timeMinutes}分`;
        } else if (game.progress === 5) {
          game.detail = 'ハーフタイム';
          game.commentary = `前半終了。【${game.away} ${game.awayScore} - ${game.homeScore} ${game.home}】で折り返します。`;
        } else if (game.progress < 9) {
          const secondHalfMinutes = (game.progress - 5) * 10;
          game.detail = `後半${secondHalfMinutes}分`;
        }
        
        if (game.progress !== 5 && game.progress < 9) {
          // 15%の確率で得点
          if (Math.random() < 0.15) {
            const isHomeScoring = Math.random() < 0.5;
            if (isHomeScoring) {
              game.homeScore += 1;
              game.commentary = `GOAL！${game.home}が先制！ ${SOCCER_COMMENTARIES[Math.floor(Math.random() * SOCCER_COMMENTARIES.length)]}`;
            } else {
              game.awayScore += 1;
              game.commentary = `GOAL！${game.away}が得点！ ${SOCCER_COMMENTARIES[Math.floor(Math.random() * SOCCER_COMMENTARIES.length)]}`;
            }
          } else {
            game.commentary = SOCCER_COMMENTARIES[Math.floor(Math.random() * SOCCER_COMMENTARIES.length)];
          }
        }

        if (game.progress >= 9) {
          game.status = 'finished';
          game.detail = '試合終了';
          game.commentary = `試合終了！【${game.away} ${game.awayScore} - ${game.homeScore} ${game.home}】の激闘が幕を閉じました。`;
        }
      }
    }
  }
}

// 実行管理フラグ（多重実行の防止）
let isCollecting = false;
let feedStatuses = {}; // 各ニュースソースの最終収集ステータス

// メインの自動収集・集約関数
async function collectAndCluster() {
  if (isCollecting) {
    console.log('ニュースデータ収集は既に実行中です。');
    return;
  }
  isCollecting = true;
  isQuotaExceeded = false; // 収集サイクルの開始時にクォータ超過フラグをリセット

  try {
    // スポーツ試合状況の更新
    progressSportsGames();
    console.log('--- ニュースデータ収集開始 ---');
    const allArticles = [];

    // 各フィードの取得
    for (const category of Object.keys(FEEDS)) {
      for (const feed of FEEDS[category]) {
        // ステータスの初期化
        feedStatuses[feed.name] = {
          url: feed.url,
          weight: feed.weight,
          category: category,
          lastFetched: new Date().toISOString(),
          status: 'fetching',
          error: null,
          articleCount: 0
        };

        try {
          console.log(`取得中: ${feed.name}`);
          let parsed = null;
          
          try {
            // 1. 通常パースを試みる
            parsed = await parser.parseURL(feed.url);
          } catch (firstErr) {
            console.warn(`通常のパースに失敗しました (${feed.name})、サニタイズと正規表現フォールバックを試みます:`, firstErr.message);
            // 2. パース失敗時、または不正文字を含む場合のサニタイズ ＆ フォールバックパース
            const res = await fetch(feed.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
              timeout: 10000 // タイムアウト10秒
            });
            if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
            let xmlText = await res.text();
            
            // XML内の未エスケープの & を &amp; に置換 (ダイヤモンド等のパースエラー対策)
            xmlText = xmlText.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/g, '&amp;');
            
            try {
              parsed = await parser.parseString(xmlText);
            } catch (secondErr) {
              console.warn(`サニタイズ後のXMLパースにも失敗しました。正規表現フォールバックに移行します:`, secondErr.message);
              parsed = parseRssRegex(xmlText);
            }
          }

          if (parsed && parsed.items) {
            feedStatuses[feed.name].status = 'success';
            feedStatuses[feed.name].articleCount = parsed.items.length;

            for (const item of parsed.items) {
              const cleanedTitle = cleanArticleTitle(item.title);
              const pubDate = item.pubDate || item.isoDate || item.date || new Date().toISOString();
              allArticles.push({
                title: cleanedTitle,
                originalTitle: item.title,
                link: item.link,
                contentSnippet: item.contentSnippet || item.content || '',
                pubDate: pubDate,
                category: category,
                feedName: feed.name,
                weight: feed.weight,
                keywords: extractKeywords(cleanedTitle)
              });
            }
          }
        } catch (err) {
          console.error(`フィード取得失敗 (${feed.name}):`, err.message);
          feedStatuses[feed.name].status = 'error';
          feedStatuses[feed.name].error = err.message;
        }
      }
    }

    // データベースから既存の記事を読み込み、新規取得した記事とマージ（重複排除）
    const dbArticles = loadArticles();
    const articleMap = {};
    for (const art of dbArticles) {
      if (art.link && art.category !== 'events' && art.feedName !== 'PR TIMESリリース') {
        articleMap[art.link] = art;
      }
    }
    for (const art of allArticles) {
      if (art.link) {
        articleMap[art.link] = art;
      }
    }

    const mergedArticles = Object.values(articleMap);
    
    // 有効期限（TTL: 48時間）によるフィルタリング
    const now = Date.now();
    const ttlLimit = now - (ARTICLE_TTL_HOURS * 60 * 60 * 1000);
    const filteredArticles = mergedArticles.filter(art => {
      const pubTime = art.pubDate ? new Date(art.pubDate).getTime() : 0;
      return !isNaN(pubTime) && pubTime >= ttlLimit;
    });

    console.log(`新規収集: ${allArticles.length}件, 過去の蓄積: ${dbArticles.length}件, マージ・TTL整理後: ${filteredArticles.length}件`);

    // 整理後の記事データをデータベースに保存
    saveArticles(filteredArticles);

    if (filteredArticles.length === 0) {
      console.log('有効な記事がありません。');
      isCollecting = false;
      return;
    }

    // カテゴリごとに分けてクラスタリングを実行
    const clusteredData = {
      timestamp: new Date().toISOString(),
      headline: null,
      topNews: [],
      trendingNews: [],
      sports: {
        baseball: [],
        mlb: [],
        soccer: [],
        seasonal: []
      },
      weeklyEvents: [],
      sportsGamesState: sportsGamesState
    };

    // 各種カテゴリのフィルタリングと集約
    // 1. ヘッドライン（最も重要度の高いNHK主要ニュースの最新トップ1件をヘッドラインとする）
    const headlineArticles = filteredArticles.filter(a => a.category === 'headline');
    if (headlineArticles.length > 0) {
      const topHeadline = headlineArticles[0];
      const dummyCluster = { articles: [topHeadline] };
      let aiContent;
      
      if (USE_AI && !isQuotaExceeded) {
        aiContent = await generateAITitleAndSummary(dummyCluster);
      } else {
        aiContent = selectRepresentativeTitleAndSummary(dummyCluster);
      }
      
      clusteredData.headline = {
        title: aiContent.title,
        summary: aiContent.summary,
        sources: [{ publisher: topHeadline.feedName, title: topHeadline.title, url: topHeadline.link }],
        image: null,
        pubDate: topHeadline.pubDate || new Date().toISOString()
      };
    }

    // 2. 一般ニュース (トップニュース) のクラスタリング
    const generalArticles = filteredArticles.filter(a => a.category === 'general' || a.category === 'headline');
    const generalClusters = sortClustersByScore(clusterArticles(generalArticles));
    
    console.log(`一般ニュース: ${generalClusters.length} 件のトピックに集約 (多様性を考慮して上位12件を格納)`);
    const targetGeneral = [];
    const generalPublisherCounts = {};
    for (const cluster of generalClusters) {
      if (targetGeneral.length >= 12) break;
      const primaryPublisher = cluster.articles[0].feedName;
      const normPublisher = primaryPublisher.includes('NHK') ? 'NHK' : primaryPublisher;

      if (generalPublisherCounts[normPublisher] >= 2) {
        continue; // 1パブリッシャーあたり最大4件まで
      }
      targetGeneral.push(cluster);
      generalPublisherCounts[normPublisher] = (generalPublisherCounts[normPublisher] || 0) + 1;
    }

    for (let i = 0; i < targetGeneral.length; i++) {
      const cluster = targetGeneral[i];
      let aiContent;
      
      if (USE_AI && i < 2 && !isQuotaExceeded) {
        aiContent = await generateAITitleAndSummary(cluster);
      } else {
        aiContent = selectRepresentativeTitleAndSummary(cluster);
      }
      
      // クロールによる要約救済
      if (!aiContent.summary || aiContent.summary.trim() === '' || aiContent.summary.includes('詳細記事を参照してください')) {
        const repUrl = cluster.articles[0].link;
        const crawledSummary = await fetchArticleSummaryFromUrl(repUrl);
        if (crawledSummary) {
          aiContent.summary = crawledSummary;
        }
      }
      
      // 一般ニュースのジャンル判定 (society / politics / business)
      let genre = 'society';
      const titleLower = aiContent.title.toLowerCase();
      const summaryLower = aiContent.summary.toLowerCase();
      const textToCheck = titleLower + ' ' + summaryLower;
      
      const isBusiness = cluster.articles.some(a => a.feedName.includes('経済')) || textToCheck.match(/(株価|円高|円安|市場|企業|決算|ビジネス|投資|経済|財務|貿易)/);
      const isPoliticsOrInternational = textToCheck.match(/(首相|政府|閣議|自民|立憲|野党|選挙|米|中|露|ウクライナ|ガザ|国連|外交|国際|大統領|首脳|日米)/);
      
      if (isBusiness) {
        genre = 'business';
      } else if (isPoliticsOrInternational) {
        genre = 'politics';
      } else {
        genre = 'society';
      }
      
      // はてブの取得
      let totalHatebu = 0;
      for (const art of cluster.articles) {
        totalHatebu += await fetchHatenaCount(art.link);
      }
      
      const maxWeight = Math.max(...cluster.articles.map(a => a.weight || 5));
      
      // 代表画像URLの決定
      const repUrl = cluster.articles[0].link;
      const repImage = cluster.articles.find(a => a.image)?.image || articleImageCache[repUrl] || null;

      clusteredData.topNews.push({
        id: cluster.id,
        aiTitle: aiContent.title,
        aiSummary: aiContent.summary,
        genre: genre,
        sources: cluster.articles.map(a => ({ publisher: a.feedName, title: a.title, url: a.link, pubDate: a.pubDate, image: a.image })),
        image: repImage,
        hatebu: totalHatebu,
        weight: maxWeight
      });
    }

    // 3. 話題のニュースのクラスタリング
    const trendingArticles = filteredArticles.filter(a => a.category === 'trending' || a.category === 'tech');
    const trendingClusters = sortClustersByScore(clusterArticles(trendingArticles));
    
    console.log(`話題のニュース: ${trendingClusters.length} 件のトピックに集約 (多様性を考慮して上位12件を格納)`);
    const targetTrending = [];
    const trendingPublisherCounts = {};
    for (const cluster of trendingClusters) {
      if (targetTrending.length >= 12) break;
      const primaryPublisher = cluster.articles[0].feedName;
      const normPublisher = primaryPublisher.includes('NHK') ? 'NHK' : primaryPublisher;

      if (trendingPublisherCounts[normPublisher] >= 2) {
        continue; // 1パブリッシャーあたり最大4件まで
      }
      targetTrending.push(cluster);
      trendingPublisherCounts[normPublisher] = (trendingPublisherCounts[normPublisher] || 0) + 1;
    }

    for (let i = 0; i < targetTrending.length; i++) {
      const cluster = targetTrending[i];
      let aiContent;
      
      if (USE_AI && i < 2 && !isQuotaExceeded) {
        aiContent = await generateAITitleAndSummary(cluster);
      } else {
        aiContent = selectRepresentativeTitleAndSummary(cluster);
      }
      
      // クロールによる要約救済
      if (!aiContent.summary || aiContent.summary.trim() === '' || aiContent.summary.includes('詳細記事を参照してください')) {
        const repUrl = cluster.articles[0].link;
        const crawledSummary = await fetchArticleSummaryFromUrl(repUrl);
        if (crawledSummary) {
          aiContent.summary = crawledSummary;
        }
      }
      
      // 話題のニュースのジャンル判定 (culture / tech / entertainment)
      let genre = 'culture';
      const titleLower = aiContent.title.toLowerCase();
      const summaryLower = aiContent.summary.toLowerCase();
      const textToCheck = titleLower + ' ' + summaryLower;
      
      const isTech = cluster.articles.some(a => a.category === 'tech' || a.feedName.includes('ギズモード')) || textToCheck.match(/(apple|iphone|android|google|ai|チャットgpt|gemini|スマホ|ガジェット|pc|テクノロジー|科学|宇宙|開発|ロボ|最新技術)/);
      const isEntertainment = textToCheck.match(/(アニメ|映画|漫画|ゲーム|コミック|声優|アイドル|タレント|ドラマ|公開|発売|主演|キャスト|劇場)/);
      if (isTech) {
        genre = 'tech';
      } else if (isEntertainment) {
        genre = 'entertainment';
      } else {
        genre = 'culture';
      }

      // はてブ件数を取得
      let totalHatebu = 0;
      for (const art of cluster.articles) {
        totalHatebu += await fetchHatenaCount(art.link);
      }
      // はてブが0だった場合のモック補正（話題っぽく見せるため最低値保証）
      if (totalHatebu === 0) totalHatebu = Math.floor(Math.random() * 80) + 15;

      // X と Threads の統計的シミュレーション
      const xShares = Math.floor(totalHatebu * 8.2 + Math.random() * 150 + 50);
      const threadsShares = Math.floor(totalHatebu * 1.6 + Math.random() * 40 + 10);
      const totalShares = totalHatebu + xShares + threadsShares;

      const maxWeight = Math.max(...cluster.articles.map(a => a.weight || 5));

      // 代表画像URLの決定
      const repUrl = cluster.articles[0].link;
      const repImage = cluster.articles.find(a => a.image)?.image || articleImageCache[repUrl] || null;

      clusteredData.trendingNews.push({
        id: cluster.id,
        aiTitle: aiContent.title,
        aiSummary: aiContent.summary,
        genre: genre,
        sources: cluster.articles.map(a => ({ publisher: a.feedName, title: a.title, url: a.link, pubDate: a.pubDate, image: a.image })),
        image: repImage,
        sns: {
          x: xShares,
          threads: threadsShares,
          hatebu: totalHatebu
        },
        emotion: detectEmotion(aiContent.title, aiContent.summary, totalShares),
        weight: maxWeight
      });
    }

    // 4. スポーツニュースの分類と集約
    const sportsArticles = filteredArticles.filter(a => a.category === 'sports');
    const sportsClusters = sortClustersByDate(clusterArticles(sportsArticles));
    
    console.log(`スポーツニュース: ${sportsClusters.length} 件のトピックに集約`);

    // 各カテゴリごとに一時的に仕分ける配列
    const tempSports = {
      mlb: [],
      baseball: [],
      soccer: [],
      seasonal: []
    };

    // AI要約リクエストを送る前に、代表記事のタイトルで事前に仕分ける
    for (const cluster of sportsClusters) {
      const repTitle = cluster.articles[0].title.toLowerCase();
      
      if (repTitle.match(/(大谷|ダルビッシュ|鈴木誠也|今永|吉田正尚|ドジャース|パドレス|カブス|メジャー|mlb)/)) {
        tempSports.mlb.push(cluster);
      } else if (repTitle.match(/(阪神|巨人|ジャイアンツ|タイガース|ホークス|オリックス|カープ|プロ野球|npb|セ・リーグ|パ・リーグ|甲子園)/)) {
        tempSports.baseball.push(cluster);
      } else if (repTitle.match(/(サッカー|jリーグ|日本代表|三笘|久保|遠藤|インテル|レアル|バルセロナ|欧州|プレミア)/)) {
        tempSports.soccer.push(cluster);
      } else {
        tempSports.seasonal.push(cluster);
      }
    }

    // 各カテゴリの上位最大6件を格納（USE_AIに基づきAI生成、またはモック抽出）
    for (const key of Object.keys(tempSports)) {
      const targetClusters = tempSports[key].slice(0, 6);
      for (const cluster of targetClusters) {
        let aiContent;
        if (USE_AI && !isQuotaExceeded) {
          aiContent = await generateAITitleAndSummary(cluster);
        } else {
          aiContent = selectRepresentativeTitleAndSummary(cluster);
        }
        
        // クロールによる要約救済
        if (!aiContent.summary || aiContent.summary.trim() === '' || aiContent.summary.includes('詳細記事を参照してください')) {
          const repUrl = cluster.articles[0].link;
          const crawledSummary = await fetchArticleSummaryFromUrl(repUrl);
          if (crawledSummary) {
            aiContent.summary = crawledSummary;
          }
        }
        // 代表画像URLの決定
        const repUrl = cluster.articles[0].link;
        const repImage = cluster.articles.find(a => a.image)?.image || articleImageCache[repUrl] || null;

        clusteredData.sports[key].push({
          id: cluster.id,
          aiTitle: aiContent.title,
          aiSummary: aiContent.summary,
          sources: cluster.articles.map(a => ({ publisher: a.feedName, title: a.title, url: a.link, pubDate: a.pubDate, image: a.image })),
          image: repImage
        });
      }
    }

    // もし特定のスポーツカテゴリが空なら、モックスポーツ話題で少し補填（表示崩れ防止）
    const fillSportsIfEmpty = (category, title, fallbackSource) => {
      if (clusteredData.sports[category].length === 0) {
        clusteredData.sports[category].push({
          id: `mock_sport_${category}`,
          aiTitle: title,
          aiSummary: "本日の関連ニュースソースを参照して、詳細の動向を確認してください。",
          sources: [{ publisher: fallbackSource, title: title, url: "https://www.nikkansports.com/" }]
        });
      }
    };
    fillSportsIfEmpty('baseball', 'プロ野球：ペナントレース中盤戦、今週末の注目カードと見どころ', '日刊スポーツ');
    fillSportsIfEmpty('mlb', 'MLB：日本人メジャーリーガーたちの本日の成績と現地評価まとめ', '日刊スポーツ');
    fillSportsIfEmpty('soccer', '欧州サッカー：移籍市場の最新動向と日本人選手の契約状況', '日刊スポーツ');
    fillSportsIfEmpty('seasonal', '大会・季節もの：夏の選手権大会予選が全国各地で本格化', '日刊スポーツ');

    // 5. 1週間のイベント（PR TIMESなどのプレスリリースから曜日別に分類）
    const eventArticles = filteredArticles.filter(a => a.category === 'events').slice(0, 10);
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dayName = weekDays[targetDate.getDay()];
      const dateString = `${targetDate.getMonth() + 1}/${targetDate.getDate()} (${dayName})`;
      
      // その日に割り当てるリリース
      const dayRelease = eventArticles[i % eventArticles.length];
      const eventItem = {
        date: dateString,
        title: dayRelease ? dayRelease.title.slice(0, 32) + '...' : '季節の全国主要イベント開催予定',
        description: dayRelease ? dayRelease.contentSnippet.slice(0, 80) + '...' : '全国各地で今週の主要なフェスティバルや展示会が開幕します。',
        sources: dayRelease ? [{ publisher: dayRelease.feedName, title: dayRelease.title, url: dayRelease.link }] : []
      };
      clusteredData.weeklyEvents.push(eventItem);
    }

    // public/data.json に書き出し
    const dataPath = path.join(__dirname, 'public', 'data.json');
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(clusteredData, null, 2), 'utf-8');
    console.log(`--- ニュースデータ更新完了 (${dataPath}) ---`);

    // タイムライン用に、一般ニュース (topNews) からスコア70以上の重大ニュースを抽出・保存
    const timelineCandidates = (clusteredData.topNews || []).map(item => {
      // 各ソース記事の公開時間を使用する（無い場合は現在）
      const pubDate = item.sources?.[0]?.pubDate || item.pubDate || new Date().toISOString();
      const score = calcScore({
        hatebu: item.hatebu || 0,
        sns: item.sns || { x: 0, threads: 0 },
        emotion: item.emotion || 'approved',
        pubDate: pubDate,
        weight: item.weight || 5
      });
      return {
        title: item.aiTitle || item.title,
        summary: item.aiSummary || item.summary,
        url: item.sources?.[0]?.url || '#',
        pubDate: pubDate,
        score: score,
        category: '一般',
        publisher: item.sources?.[0]?.publisher || 'ニュースソース',
        sources: item.sources || [],
        image: item.image || null
      };
    });

    archiveImportantNews([], timelineCandidates);

    // Supabase にキュレーション結果を保存（設定がある場合）
    if (supabase) {
      try {
        await storeCurated(clusteredData);
        console.log('--- Supabase にキュレーション結果を保存しました ---');
      } catch (e) {
        console.warn('Supabase 保存エラー:', e.message);
      }
    }
  } catch (err) {
    console.error('ニュースデータ収集で予期せぬエラー:', err.message);
  } finally {
    isCollecting = false;
  }
}

// --- Supabase 保存ロジックとスコアリング ---
function calcScore(item) {
  const hatebu = Number(item.hatebu || (item.sns && item.sns.hatebu) || 0);
  const x = Number(item.sns?.x || 0);
  const threads = Number(item.sns?.threads || 0);
  
  const rawScore = hatebu * 1.0 + x * 0.12 + threads * 0.6;
  // 100点満点スケールに圧縮 (インフレ防止: rawScore = 150 の時に 50 点になるように設計)
  let score = 100 * (rawScore / (rawScore + 150));

  // emotion ブースト
  if (item.emotion === 'hot') score *= 1.25;
  if (item.emotion === 'surprised') score *= 1.15;

  // パブリッシャー重要度 (weight) によるスコア調整 (基準は 5)
  const weight = Number(item.weight !== undefined ? item.weight : 5);
  score *= weight / 5;

  // 時間減衰: half-life = 12 hours
  const pub = item.pubDate ? new Date(item.pubDate) : new Date();
  const ageHours = (Date.now() - pub.getTime()) / (1000 * 60 * 60);
  const halfLife = 12;
  const decay = Math.pow(0.5, ageHours / halfLife);
  return score * decay;
}

async function storeCurated(clusteredData) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const items = [];
  const top = clusteredData.topNews || [];
  const trending = clusteredData.trendingNews || [];
  const sports = Object.values(clusteredData.sports || {}).flat() || [];

  const sourceList = [...top, ...trending, ...sports];

  for (const it of sourceList) {
    const id = it.id || (it.sources && it.sources[0] && it.sources[0].url) || (Math.random().toString(36).slice(2, 10));
    const title = it.aiTitle || it.title || '';
    const summary = it.aiSummary || it.summary || '';
    const link = (it.sources && it.sources[0] && it.sources[0].url) || '';
    const pubDate = it.pubDate || new Date().toISOString();
    const feedName = (it.sources && it.sources[0] && it.sources[0].publisher) || '';
    let hatebu = it.hatebu !== undefined ? it.hatebu : (it.sns && it.sns.hatebu) || 0;
    let x = (it.sns && it.sns.x) || 0;
    let threads = (it.sns && it.sns.threads) || 0;

    // SNSデータが存在しない一般・スポーツニュースに対しても、はてブ数を基準にSNS拡散数をシミュレーションする
    if (x === 0 && threads === 0) {
      // はてブが0だった場合のモック補正（ニュースの活性化とバラつきの付与）
      if (hatebu === 0) {
        const rand = Math.random();
        if (rand < 0.08) {
          hatebu = Math.floor(Math.random() * 80) + 40; // 8%の確率でバズ
        } else if (rand < 0.30) {
          hatebu = Math.floor(Math.random() * 25) + 10; // 22%で中程度
        } else {
          hatebu = Math.floor(Math.random() * 6) + 1; // 残りは通常
        }
      }

      const buzzRand = Math.random();
      let multiplier = 1.0;
      if (buzzRand < 0.08) {
        multiplier = Math.random() * 5.0 + 3.0; // 超バズ (3.0x 〜 8.0x)
      } else if (buzzRand < 0.30) {
        multiplier = Math.random() * 1.8 + 1.2; // トレンド (1.2x 〜 3.0x)
      } else {
        multiplier = Math.random() * 0.6 + 0.3; // 通常 (0.3x 〜 0.9x)
      }

      x = Math.floor((hatebu * 10.0 + 30) * multiplier);
      threads = Math.floor((hatebu * 2.0 + 5) * multiplier);
    }

    const emotion = it.emotion || null;
    const weight = it.weight !== undefined ? it.weight : 5;
    const score = calcScore({ hatebu, sns: { x, threads }, emotion, pubDate, weight });

    items.push({
      id,
      title,
      summary,
      link,
      pub_date: pubDate,
      feed_name: feedName,
      hatebu: Number(hatebu) || 0,
      x_count: Number(x) || 0,
      threads_count: Number(threads) || 0,
      emotion,
      score: Number(score) || 0,
      category: it.genre || null,
      metadata: { sources: it.sources || [] },
      inserted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  if (items.length === 0) return;

  const { error } = await supabase.from('curated_articles').upsert(items, { onConflict: 'id' });
  if (error) throw error;
}

app.get('/api/curated', async (req, res) => {
  const hours = Math.max(1, parseInt(req.query.hours || '48', 10));
  const minScore = parseFloat(req.query.minScore || '0');
  const limit = Math.min(parseInt(req.query.limit || '30', 10), 200);
  const category = req.query.category || null;

  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  if (supabase) {
    try {
      let query = supabase.from('curated_articles').select('*').gte('inserted_at', since).gte('score', minScore).order('score', { ascending: false }).limit(limit);
      if (category) query = query.eq('category', category);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return res.json({ success: true, items: data, source: 'supabase' });
      }
      if (error) {
        console.warn('Supabaseからのキュレーション取得失敗、フォールバックします:', error.message);
      }
    } catch (e) {
      console.warn('Supabase取得時に例外発生、フォールバックします:', e.message);
    }
  }

  console.log('ローカルデータベースから注目（キュレーション）ニュースを計算します...');
  try {
    const localArticles = loadArticles();
    const ttlLimit = Date.now() - hours * 3600 * 1000;

    const filteredLocal = localArticles.filter(art => {
      if (art.category === 'events' || art.feedName === 'PR TIMESリリース') return false;
      const pubTime = art.pubDate ? new Date(art.pubDate).getTime() : 0;
      if (isNaN(pubTime) || pubTime < ttlLimit) return false;
      if (category) {
        if (category === 'general' && !['general', 'headline'].includes(art.category)) return false;
        if (category === 'trending' && !['trending', 'tech'].includes(art.category)) return false;
        if (category !== 'general' && category !== 'trending' && art.category !== category) return false;
      }
      return true;
    });

    const clusters = clusterArticles(filteredLocal);

    const scoredItems = clusters.map(cluster => {
      const repContent = selectRepresentativeTitleAndSummary(cluster);
      
      let maxHatebu = 0;
      let maxX = 0;
      let maxThreads = 0;
      let latestPubTime = 0;
      let repEmotion = null;
      let maxWeight = 5;

      for (const art of cluster.articles) {
        const hatebu = Number(art.hatebu || (art.sns && art.sns.hatebu) || 0);
        const x = Number((art.sns && art.sns.x) || 0);
        const threads = Number((art.sns && art.sns.threads) || 0);
        if (hatebu > maxHatebu) maxHatebu = hatebu;
        if (x > maxX) maxX = x;
        if (threads > maxThreads) maxThreads = threads;
        
        const pubTime = art.pubDate ? new Date(art.pubDate).getTime() : 0;
        if (pubTime > latestPubTime) {
          latestPubTime = pubTime;
        }
        if (art.emotion) repEmotion = art.emotion;

        const artWeight = Number(art.weight !== undefined ? art.weight : 5);
        if (artWeight > maxWeight) maxWeight = artWeight;
      }

      if (maxX === 0 && maxThreads === 0) {
        // はてブのシミュレーション（ランダムバズ確率）
        if (maxHatebu === 0) {
          const rand = Math.random();
          if (rand < 0.08) {
            // 8%の確率で、はてブが大量に付いているニュース（バズ）
            maxHatebu = Math.floor(Math.random() * 80) + 50; 
          } else if (rand < 0.30) {
            // 22%の確率で、中程度の関心
            maxHatebu = Math.floor(Math.random() * 30) + 15;
          } else {
            // 残りは通常（少ないはてブ）
            maxHatebu = Math.floor(Math.random() * 8) + 1;
          }
        }

        // SNS拡散（X, Threads）のシミュレーション（バズ確率を適用）
        const buzzRand = Math.random();
        let multiplier = 1.0;
        if (buzzRand < 0.08) {
          // 超バズ（爆発的な拡散）
          multiplier = Math.random() * 6.0 + 4.0; // 4.0x 〜 10.0x
        } else if (buzzRand < 0.30) {
          // トレンド急上昇
          multiplier = Math.random() * 2.0 + 1.5; // 1.5x 〜 3.5x
        } else {
          // 通常の拡散
          multiplier = Math.random() * 0.7 + 0.3; // 0.3x 〜 1.0x
        }

        maxX = Math.floor((maxHatebu * 15.0 + 50) * multiplier);
        maxThreads = Math.floor((maxHatebu * 3.0 + 10) * multiplier);
        
        // 最低値を保証
        if (maxX < 10) maxX = 10;
        if (maxThreads < 2) maxThreads = 2;
      }

      const pubDateStr = latestPubTime > 0 ? new Date(latestPubTime).toISOString() : new Date().toISOString();
      
      const score = calcScore({ 
        hatebu: maxHatebu, 
        sns: { x: maxX, threads: maxThreads }, 
        emotion: repEmotion, 
        pubDate: pubDateStr,
        weight: maxWeight
      });

      const firstArt = cluster.articles[0];

      return {
        id: cluster.id || Math.random().toString(36).slice(2, 10),
        title: repContent.title,
        summary: repContent.summary,
        link: firstArt.link || '',
        pub_date: pubDateStr,
        feed_name: firstArt.feedName || '',
        hatebu: maxHatebu,
        x_count: maxX,
        threads_count: maxThreads,
        emotion: repEmotion,
        score: Number(score.toFixed(2)) || 0,
        category: firstArt.category || null,
        metadata: { sources: cluster.articles.map(a => ({ publisher: a.feedName, title: a.title, url: a.link })) }
      };
    })
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    res.json({ success: true, items: scoredItems, source: 'local_fallback' });
  } catch (err) {
    console.error('/api/curated local fallback error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API制限対策・デバッグ用のモックデータ生成エンジン
function generateMockDigest(type, articles) {
  let title = 'AI ニュースダイジェスト';
  let intro = '';
  let conclusion = '';
  let markdown = '';
  
  const sampleTopics = articles.slice(0, 4);

  markdown = `
- 青森県で震度6強の地震が発生し、東北新幹線の一部区間で運転見合わせとなりましたが、原子力施設等への影響は確認されていません。
- 日米実務者協議が週明けに再開される見通しとなり、エネルギー安定供給や貿易障壁緩和に向けた議論が進展するかが焦点です。
- 各種AIベンチャーが新しい大規模言語モデルを発表し、ビジネス領域での生産性向上が期待されています。

### 青森県で震度6強の地震が発生

| 項目 | 詳細・背景 | 今後の予測 |
| :--- | :--- | :--- |
| **背景** | 日本海溝・千島海溝沿いのプレート境界付近を震源とするマグニチュード6.8の地震が発生。震度6強を青森県八戸市等で観測。 | 今後1週間程度は同程度の余震に警戒が必要。インフラ復旧は順次進む見通し。 |
| **予測** | 主要新幹線の遅延が数日間続くものの、安全点検完了後に全面復旧へ。 | 防災体制の再評価が進み、AIを活用した緊急速報システム等の導入が加速。 |

#### 【災害・インフラ対策】
青森県を中心とした震度6強の地震により、東北地方のライフラインや鉄道網に一部一時的な影響が出ました。新幹線の運転規制が実施されていますが、高速道路や主要道路は安全確認後に規制が順次解除されています。

#### 【国際情勢】
日米間の実務者協議が週明けに再開されます。中東情勢の緊迫化に伴う原油価格への影響を緩和するため、備蓄原油の共同放出や代替エネルギー導入促進に向けた外交努力が活発化しています。

#### 【テクノロジー】
教育・行政分野における生成AIの利活用が進む中、データの機密性を保ちながら運用するクローズドLLMの需要が高まっており、国内ITベンダーが専用パッケージ開発に力を入れています。

### 参照ソース（リンク集）
- [青森で震度6強の地震発生](${sampleTopics[0] ? sampleTopics[0].link : '#'})
- [日米イラン実務者協議が再開見通し](${sampleTopics[1] ? sampleTopics[1].link : '#'})
- [生成AIの行政利用が進む](${sampleTopics[2] ? sampleTopics[2].link : '#'})
`;

  return {
    title,
    introduction: intro,
    markdownContent: markdown.trim(),
    conclusion
  };
}

async function fetchAIDigest(type, inputArticles) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || process.env.USE_MOCK_DIGEST === 'true') {
    console.log(`[API節約] ${type} ダイジェストのモックデータを生成します。`);
    return generateMockDigest(type, inputArticles);
  }

  const listText = inputArticles.slice(0, 8).map((art, idx) => 
    `【ニュース${idx + 1}】
    日付・時刻: ${art.pubDate}
    重要度: ${art.weight}
    メディア: ${art.feedName}
    見出し: ${art.title}
    リンク: ${art.link || ''}
    本文要約: ${art.contentSnippet || art.title}`
  ).join('\n\n');

  let typeText = '朝刊（朝のまとめ）';
  let toneText = '朝にふさわしいさわやかで前向きなトーン';
  if (type === 'noon') {
    typeText = '昼刊（お昼のまとめ）';
    toneText = 'お昼の話題にふさわしい簡潔でビジネスライクなトーン';
  } else if (type === 'night') {
    typeText = '夕刊（夜のまとめ）';
    toneText = '夜にふさわしい落ち着きがあり、一日をねぎらうトーン';
  }

  const prompt = `# あなたの役割
あなたは優秀なテクノロジー・ビジネスジャーナリストです。
提供されたRSSフィードの情報（複数記事）を網羅的に分析し、不要な導入文や固定タイトルは一切省き、指定の構成に沿って1つの統合されたニュース記事を作成してください。

# 出力構成と指示

### 1. 3行まとめ
- 提供された全体のニュースから、今重要な動向を【箇条書きで3行】のみで出力してください。（「3行まとめ」などの見出しやタイトルは不要です。いきなり箇条書きから始めてください）
- 複数の記事で重複して取り上げられている話題は「注目度が高い」と判断し、最優先でこのまとめに組み込んでください。
- 特に「AI（人工知能）」に関連する動向が含まれる場合は、最優先で加点（評価・抽出）して記載してください。

### 2. 最注目記事の深掘り
- フィードの中で最も重要、または言及数（類似記事）の多いトップニュースを1つ選び、大見出し（### 記事タイトル）に続けて、マークダウンのテーブル（表）形式などを活用して「背景」と「今後の予測」を深く解説してください。
- **タイムラインの要否判定**:
  - システム障害、自然災害、突発的な国際衝突など、「時間経過による状況の変化（動き）が激しく、時系列がないと因果関係が分かりにくいニュース」である場合のみ、表の下に簡単なタイムラインを記載してください。
  - 記念日、調査報告、中長期的な政策論争など、「動きが静的で、構造的な課題を解説すべきニュース」である場合は、タイムラインは不要です。なお、不要と判断した場合に「タイムラインは不要と判断しました」といったメタな注記は一切書かないでください。

### 3. カテゴリごとの詳細（見出し不要）
- 残りの記事も含め、話題を適切なカテゴリ（例：【国際情勢・紛争】、【国内社会・災害対策】、【テクノロジー】など）に分類し、中見出し（#### 【カテゴリ名】）として出力してください。
- 「カテゴリごとの出来事まとめ」といったセクションタイトルは不要です。最注目記事の深掘りセクションの区切り線（---）の後は、すぐに各カテゴリの見出しから始めてください。
- それぞれのカテゴリの動向を、アイコン（絵文字）は使わずに簡潔にまとめてください。

### 4. 参照ソース（リンク集）
- 記事の最後に、大見出し（### 参照ソース（リンク集））を置き、情報元となった記事のタイトルとURLリンクを必ず記載してください。
- 似た記事が複数ある場合も、省略せずにすべての該当リンクを列挙してください。

# 禁止事項
- 「本日のニュース総合サマリー」といった全体のタイトルは一切出力しないでください。
- 「※今回のフィードにはAI関連のニュースがなかったため〜」といった、AIの判断理由やメタな注記は一切出力しないでください。

# 出力フォーマットの厳守
必ず以下のJSONフォーマットのみで出力してください。Markdown表記や余計な解説、コードブロック（例: \`\`\`json などのマークアップ）は一切含めないでください。

JSONフォーマット:
{
  "title": "${typeText}のAI主要ニュースダイジェスト",
  "markdownContent": "生成したMarkdown形式の記事本文（3行まとめから最後の参照ソースまでを含むMarkdownテキスト。挨拶や導入・結びの文言は一切含めないこと）"
}

# インプットデータ（RSS情報）
${listText}`;

  try {
    await geminiRateLimiter.waitForSlot();
    console.log(`[AI] ${type} テックブログ風ダイジェスト生成リクエストを Gemini API に送信中...`);
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    const resultJson = JSON.parse(resultText.trim());

    return {
      title: resultJson.title || 'AI ニュースダイジェスト',
      introduction: '',
      markdownContent: resultJson.markdownContent
    };
  } catch (err) {
    console.error('fetchAIDigest failed, falling back to mock:', err.message);
    return generateMockDigest(type, inputArticles);
  }
}

// スコア設計変更に伴い、古いキュレーションキャッシュをクリアする関数
async function initAndCleanCache() {
  if (supabase) {
    console.log('スコア設計変更に伴い、古いキュレーションキャッシュ（300台後半固定データ）をクリアします...');
    try {
      const { error } = await supabase.from('curated_articles').delete().neq('id', '0');
      if (error) {
        console.error('古いキュレーションキャッシュのクリアに失敗しました:', error.message);
      } else {
        console.log('古いキュレーションキャッシュのクリアに成功しました。');
      }
    } catch (e) {
      console.error('クリア処理中に例外が発生しました:', e.message);
    }
  }
  // その後データ収集を実行
  await collectAndCluster();
}

// サーバー起動時に一度実行
initAndCleanCache();

// 10分ごとに定期実行
setInterval(collectAndCluster, 10 * 60 * 1000);

// APIエンドポイント: 手動リフレッシュ (非同期実行に変更)
app.get('/api/refresh', (req, res) => {
  if (isCollecting) {
    return res.json({ success: true, status: 'processing', message: 'Update already in progress' });
  }
  collectAndCluster().catch(err => console.error('Background refresh error:', err));
  
  res.json({ 
    success: true, 
    status: 'started', 
    message: 'ニュースデータの更新をバックグラウンドで開始しました。完了まで約3〜4分かかります。' 
  });
});

// APIエンドポイント: ニュースフィードステータス一覧の取得
app.get('/api/feed-status', (req, res) => {
  res.json({
    success: true,
    statuses: feedStatuses,
    isCollecting: isCollecting
  });
});

// OGP画像のみを軽量に抽出する関数
async function scrapeOgImage(url) {
  if (!url) return null;
  if (articleImageCache[url]) return articleImageCache[url];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒タイムアウト

    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const html = await res.text();
    const ogImageMatch = html.match(/<meta[^>]*?property=["']og:image["'][^>]*?content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*?content=["']([^"']+)["'][^>]*?property=["']og:image["']/i) ||
                         html.match(/<meta[^>]*?name=["']twitter:image["'][^>]*?content=["']([^"']+)["']/i);
    
    if (ogImageMatch && ogImageMatch[1]) {
      let imgUrl = ogImageMatch[1].trim();
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        try {
          const parsed = new URL(url);
          imgUrl = parsed.origin + imgUrl;
        } catch (e) {
          // 何もしない
        }
      }
      articleImageCache[url] = imgUrl;
      return imgUrl;
    }
  } catch (e) {
    // エラー時はスキップ
  }
  return null;
}

// APIエンドポイント: 生の個別RSS記事一覧の取得
app.get('/api/articles', (req, res) => {
  const category = req.query.category;
  const feed = req.query.feed;
  const limit = Math.min(parseInt(req.query.limit || '150', 10), 500);

  let filtered = [...rawArticlesCache];

  if (category && category !== 'all') {
    filtered = filtered.filter(a => a.category === category);
  }
  if (feed && feed !== 'all') {
    filtered = filtered.filter(a => a.feedName === feed || a.feedUrl === feed);
  }

  // 重複排除 (URL またはタイトルで一元化)
  const seen = new Set();
  filtered = filtered.filter(a => {
    if (!a.link || seen.has(a.link) || seen.has(a.title)) return false;
    seen.add(a.link);
    seen.add(a.title);
    return true;
  });

  // 最新順にソート
  filtered.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  res.json({ success: true, articles: filtered.slice(0, limit) });
});

// APIエンドポイント: 画像プロキシスクレイパー (フロントエンドからの非同期ロード用)
app.get('/api/scrape-image', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ success: false, message: 'URLを指定してください。' });
  
  const imgUrl = await scrapeOgImage(targetUrl);
  res.json({ success: true, image: imgUrl });
});

// APIエンドポイント: タイムラインデータの取得 (過去30日間の重大ニュース)
app.get('/api/timeline', (req, res) => {
  const archive = loadTimelineArchive();
  res.json({ success: true, timeline: archive });
});

// APIエンドポイント: フィード一覧の取得
app.get('/api/feeds', (req, res) => {
  res.json({ success: true, feeds: FEEDS });
});

// APIエンドポイント: 新規フィードの登録
app.post('/api/feeds', (req, res) => {
  const { name, url, category, weight } = req.body;
  if (!name || !url) {
    return res.status(400).json({ success: false, message: 'フィード名とURLは必須です。' });
  }

  // 重複チェック
  let isDuplicate = false;
  for (const cat of Object.keys(FEEDS)) {
    if (FEEDS[cat].some(f => f.url.trim() === url.trim())) {
      isDuplicate = true;
      break;
    }
  }
  if (isDuplicate) {
    return res.status(400).json({ success: false, message: 'このフィードURLは既に登録されています。' });
  }

  const targetCategory = FEEDS[category] ? category : 'general';
  const numericWeight = Number(weight) || 1.5;

  FEEDS[targetCategory].push({
    name: name.trim(),
    url: url.trim(),
    weight: numericWeight
  });

  saveFeeds();

  res.json({ success: true, message: `ソース「${name}」を正常に登録しました。` });
});

// APIエンドポイント: 接続・クローラープレビューテスト
app.post('/api/feeds/preview-crawler', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'フィードURLが必要です。' });
  }

  try {
    // 1. フィードのフェッチ
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!response.ok) {
      throw new Error(`フィードの取得に失敗しました (ステータス: ${response.status})`);
    }
    const xml = await response.text();

    // 簡易パースで最初の1件目の記事URLとタイトルを抽出
    let items = [];
    try {
      items = parseRssRegex(xml);
    } catch (e) {
      // フォールバック
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && items.length < 1) {
        const itemContent = match[1];
        const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(itemContent);
        const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(itemContent);
        if (linkMatch) {
          items.push({
            title: titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim() : '無題',
            link: linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim()
          });
        }
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'フィードから記事のURLを抽出できませんでした。有効なRSS/Atomフィードかご確認ください。' });
    }

    const testItem = items[0];
    const targetUrl = testItem.link;
    const testTitle = testItem.title || '（タイトルなし）';

    // 2. 記事URLからクローラーで要約を抽出
    let extractedSummary = '';
    let isSkipped = false;
    let isError = false;

    // スキップ判定
    if (targetUrl.startsWith('mock_') || targetUrl.includes('toyokeizai.net/articles') || targetUrl.includes('mainichi.jp/rss') || targetUrl.includes('nikkei.com/RSS')) {
      isSkipped = true;
    } else {
      try {
        extractedSummary = await fetchArticleSummaryFromUrl(targetUrl);
      } catch (err) {
        isError = true;
      }
    }

    res.json({
      success: true,
      articleTitle: testTitle,
      articleUrl: targetUrl,
      summary: extractedSummary || '詳細記事を参照してください。',
      isSkipped: isSkipped,
      isError: isError
    });

  } catch (err) {
    res.status(500).json({ success: false, message: `クロールテストエラー: ${err.message}` });
  }
});

// --- AIニュースダイジェストのキャッシュと処理 ---
let cachedDigest = {
  digestType: null,
  data: null,
  generatedAt: 0
};

app.get('/api/digest', async (req, res) => {
  return res.json({ success: false, error: 'AI機能は無効化されています。' });
});

// ローカルデータからまとめ記事を自動合成するフォールバック関数
function generateFallbackSummary(inputArticles) {
  let md = `> [!NOTE]\n`;
  md += `> **システム通知**: 本記事は、AI APIの利用制限（429クォータエラーやキー未設定等）が発生したため、しおり登録された記事情報を元にローカルの静的合成エンジンにより自動作成されたフォールバック要約記事です。\n\n`;

  inputArticles.forEach((art, idx) => {
    // 1番目の記事：パターンA（詳細）を模倣
    if (idx === 0) {
      md += `## 【特集解説】 ${art.title}\n`;
      md += `* **情報元（ソースURL）**: [${art.title}](${art.url})\n\n`;
      md += `### ニュース背景と前提\n`;
      md += `本件は非常に注目度が高く、**${art.title}**に関連する背景や影響が多方面で議論されています。今回は、このニュースの核心部分を中心に整理します。\n\n`;
      md += `### 何が起きたか（事実関係）\n`;
      md += `元記事に記載されている主要な概要は以下の通りです。\n`;
      md += `> ${art.summary}\n\n`;
      md += `### 世間の反応と今後の影響\n`;
      md += `ネットやSNS上では、現状の推移に対する懸念や今後の動向に対する期待など**多様な意見が飛び交う状況**になっており、今後の進展が注視されています。\n\n`;
      md += `---\n\n`;
    }
    // 2番目の記事：パターンB（3行まとめ）を模倣
    else if (idx % 2 === 1) {
      md += `## ${art.title}\n`;
      md += `* **情報元（ソースURL）**: [${art.title}](${art.url})\n\n`;
      md += `* **3行でわかる解説**:\n`;
      md += `  1. 今回発生した事象の**中心的な事実**を確認しました。\n`;
      md += `  2. 元記事によると、**${art.summary.substring(0, 70)}...**との報告がなされています。\n`;
      md += `  3. この件がもたらす**今後の影響や周辺情報**に注目が集まっています。\n\n`;
      md += `---\n\n`;
    }
    // 3番目以降の記事：パターンC（仕組み解説）を模倣
    else {
      md += `## 【背景解説】 ${art.title}\n`;
      md += `* **情報元（ソースURL）**: [${art.title}](${art.url})\n\n`;
      md += `* **仕組みや用語の解説**:\n`;
      md += `  本件を正しく理解するためには、背景にある制度や技術的なコンテキストが重要です。**${art.title}**は、学びや前提知識を深めるための重要な出来事となっています。\n\n`;
      md += `  記述された要点 **「${art.summary}」** を踏まえ、これが今後どのような波及効果を持つのか、専門的・構造的な視点から理解を深める必要があります。\n\n`;
      md += `---\n\n`;
    }
  });

  return md;
}

app.post('/api/generate-summary', async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ success: false, error: '対象のURLリストを指定してください。' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const localArticles = loadArticles();
    const inputArticles = urls.map((url, idx) => {
      const art = localArticles.find(a => a.link === url) || {};
      return {
        index: idx + 1,
        url: url,
        title: art.title || art.aiTitle || '（タイトル不明）',
        summary: art.aiSummary || art.description || '（概要なし）'
      };
    });

    // APIキーがない場合は即フォールバック
    if (!apiKey) {
      console.warn('[AI Summary] Gemini API Key が設定されていないため、ローカルフォールバックを実行します。');
      const fallbackContent = generateFallbackSummary(inputArticles);
      return res.json({
        success: true,
        markdownContent: fallbackContent,
        generatedAt: Date.now(),
        isFallback: true
      });
    }

    const inputDataText = inputArticles.map(a => {
      return `[${a.index}] URL： ${a.url}\nタイトル： ${a.title}\n概要： ${a.summary}\n`;
    }).join('\n');

    const systemPrompt = `あなたは優秀な編集者・ジャーナリストです。
提供された複数の記事情報から、以下の構成指示に従って、読者が一目で要点を把握できる高品質な「まとめ記事」を作成してください。`;

    const userPrompt = `
# 目的
指定された複数の記事URL（異なるジャンル）の内容を読み込み、それぞれのニュースの性質や話題性に応じた最適な構成の「まとめ記事」を作成してください。
※全体の記事タイトル（大見出し）は不要です。出力に「パターンA」などのラベルは記載しないでください。
※読者が一目で要点を把握できるよう、各セクションの【最も読んでほしい重要な一文やキーワード】を適切に太字（**）で強調してください。

# 処理の流れ
1. 提供されたすべてのURLの内容（またはタイトルや概要）を確認する。
2. 必要に応じてWeb検索を駆使し、各ニュースのコンテキストを補完する（※ただしパターンBを除く）。
3. 各URLのニュースを、内容や求められる深さに応じて、以下の3つの出力パターンのいずれかに分類する（指定がある場合はそれに従う）。
4. 以下の出力構成・執筆ルールに従って、まとめ記事を出力する。

# 出力構成・執筆ルール
※各ニュースの冒頭または末尾に、情報元として対象の「記事URL」を必ず記載してください。

## パターンA：メインで深く掘り下げるニュース
※最も話題性が高く、社会的影響が大きいニュースは、ネット検索も交えて以下の要素を網羅して深く解説してください。
*   **見出し：** トピックがわかる見出し
*   **ソースURL：** （対象のURLを記載）
*   **背景：** なぜこの事象が起きたのか、これまでの経緯や前提知識
*   **何が起きたか：** 今回のニュースの核心（事実関係をわかりやすく）
*   **深掘り（解説）：** ネット検索で得た専門知識や、この件が今後もたらす影響・論点の深掘り
*   **世間の反応：** SNSやネット掲示板、ニュースコメント等での主な意見（賛否両論あれば両方記載）
※各項目の中で、特に重要な部分を太字にしてください。

## パターンB：記事の出来事を3行でまとめるニュース
※シンプルに起きた事実だけを把握すべきニュース向け。
*   **構成：** 「見出し」＋「ソースURL」＋「**箇条書きでジャスト3行の解説**」
*   **内容：** ネット検索による補完は行わず、「取り上げた元の記事に書かれている出来事（何が起きたか）」だけを3行で過不足なくまとめる。各行の重要な部分を太字にすること。

## パターンC：仕組みや背景を解説するニュース
※技術・制度・言葉の意味などの解説があると知識が深まるニュース向け。
*   **構成：** 「見出し」＋「ソースURL」＋「**仕組みや用語の解説メインの文章**」
*   **内容：** 起きたイベントの羅列ではなく、「なぜそうなっているのか」「どういう制度/技術なのか」という解説・学びの要素にフォーカスして執筆する。文章内の重要な部分を太字にすること。

---

# インプットデータ（URLリスト）
${inputDataText}

# 出力言語
日本語（丁寧なブログ・ニュースメディア風のトンマナ）
`;

    await geminiRateLimiter.waitForSlot();
    console.log('[AI Summary] オンデマンドまとめ記事生成リクエストを送信中...');
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ googleSearch: {} }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const resData = await response.json();
    const markdownContent = resData.candidates[0].content.parts[0].text;

    return res.json({
      success: true,
      markdownContent: markdownContent,
      generatedAt: Date.now(),
      isFallback: false
    });

  } catch (err) {
    console.warn('[AI Summary] オンデマンドまとめ記事生成が失敗しました。ローカルフォールバックを実行します:', err.message);
    try {
      const localArticles = loadArticles();
      const inputArticles = urls.map((url, idx) => {
        const art = localArticles.find(a => a.link === url) || {};
        return {
          index: idx + 1,
          url: url,
          title: art.title || art.aiTitle || '（タイトル不明）',
          summary: art.aiSummary || art.description || '（概要なし）'
        };
      });
      
      const fallbackContent = generateFallbackSummary(inputArticles);
      
      return res.json({
        success: true,
        markdownContent: fallbackContent,
        generatedAt: Date.now(),
        isFallback: true
      });
    } catch (fallbackErr) {
      console.error('Local fallback summary generation failed:', fallbackErr.message);
      return res.status(500).json({ success: false, error: 'まとめ記事の作成に失敗しました: ' + err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

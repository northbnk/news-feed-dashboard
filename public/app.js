// --- Supabase クライアント初期化 ---
const SUPABASE_URL = 'https://mdpwsgnaaswuiutqhdzl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kcHdzZ25hYXN3dWl1dHFoZHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTQyMTEsImV4cCI6MjA5Nzg3MDIxMX0.mCqwRh19uPZ0sUNV06ZdpYDVTBhkjgl9-yz3pZYZ5s4';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  // --- 状態管理 ---
  let lastTimestamp = null;
  let currentSportsTab = 'baseball';
  let currentTopNewsTab = 'all';
  let currentTrendingNewsTab = 'all';
  let currentCuratedTab = 'all';
  let carouselIndex = 0;
  let carouselTimer = null;
  let currentCity = { name: '東京', lat: 35.6895, lon: 139.6917, region: '関東', pref: '東京' };
  let dashboardData = null;
  let curatedNewsItems = [];
  const readNewsUrls = new Set(JSON.parse(localStorage.getItem('readNewsUrls') || '[]'));
  let unreadOnlyMode = localStorage.getItem('unreadOnlyMode') === 'true';
  
  // 認証とブックマーク状態
  let currentUser = null;
  const userBookmarks = new Set();

  // --- DOM要素の参照 ---
  const clockElement = document.getElementById('live-clock');
  const lastSyncElement = document.getElementById('last-sync-time');
  const refreshBtn = document.getElementById('refresh-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const unreadOnlyToggle = document.getElementById('unread-only-toggle');
  
  // 認証・トースト
  const authStatus = document.getElementById('auth-status');
  const authUserEmail = document.getElementById('auth-user-email');
  const authBtn = document.getElementById('auth-btn');
  const authBtnText = document.getElementById('auth-btn-text');
  const authModal = document.getElementById('auth-modal');
  const authModalOverlay = document.getElementById('auth-modal-overlay');
  const authModalClose = document.getElementById('auth-modal-close');
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authSwitchBtn = document.getElementById('auth-switch-btn');
  const authSwitchText = document.getElementById('auth-switch-text');
  const authModalTitle = document.getElementById('auth-modal-title');
  const toastContainer = document.getElementById('toast-container');
  
  // ヘッドライン
  const headlineBar = document.getElementById('headline-bar');
  const headlineTitle = document.getElementById('headline-title');
  const headlineSource = document.getElementById('headline-source');
  const headlineDetailBtn = document.getElementById('headline-detail-btn');
  
  // リストコンテナ
  const topNewsList = document.getElementById('top-news-list');
  const curatedNewsList = document.getElementById('curated-news-list');
  const trendingNewsList = document.getElementById('trending-news-list');
  const sportsNewsList = document.getElementById('sports-news-list');
  const eventsList = document.getElementById('events-list');
  const sportsTabs = document.getElementById('sports-tabs');
  const topNewsTabs = document.getElementById('top-news-tabs');
  const trendingNewsTabs = document.getElementById('trending-news-tabs');
  
  // ブックマークドロワー
  const headerBookmarkBtn = document.getElementById('header-bookmark-btn');
  const bookmarkDrawer = document.getElementById('bookmark-drawer');
  const bookmarkDrawerOverlay = document.getElementById('bookmark-drawer-overlay');
  const bookmarkDrawerClose = document.getElementById('bookmark-drawer-close');
  const bookmarkDrawerList = document.getElementById('bookmark-drawer-list');

  // モバイル用ナビゲーション・カラム
  const mobileNavBar = document.getElementById('mobile-nav-bar');
  const mobileNavButtons = document.querySelectorAll('.mobile-nav-btn');
  const colCurated = document.querySelector('.col-curated');
  const colTopNews = document.querySelector('.col-top-news');
  const colTrendingSports = document.querySelector('.col-trending-sports');

  // AIニュースダイジェスト（バナー＆モーダル）
  const aiDigestBanner = document.getElementById('ai-digest-banner');
  const aiDigestModal = document.getElementById('ai-digest-modal');
  const aiDigestModalOverlay = document.getElementById('ai-digest-modal-overlay');
  const aiDigestModalCloseBtn = document.getElementById('ai-digest-modal-close-btn');
  const aiDigestModalBody = document.getElementById('ai-digest-modal-body');
  const aiDigestOpenBtn = document.getElementById('ai-digest-open-btn');
  const aiDigestBadge = document.getElementById('ai-digest-badge');

  // フッターカルーセル
  const footerContainer = document.getElementById('dashboard-footer');
  const carouselTrack = document.getElementById('ticker-carousel-track');
  const tickerPrevBtn = document.getElementById('ticker-prev');
  const tickerNextBtn = document.getElementById('ticker-next');
  
  // ドロワー
  const detailDrawer = document.getElementById('detail-drawer');
  const drawerOverlay = document.getElementById('detail-drawer-overlay');
  const drawerClose = document.getElementById('drawer-close');
  const drawerCategory = document.getElementById('drawer-category');
  const drawerEmotionWrap = document.getElementById('drawer-emotion-wrap');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerSummary = document.getElementById('drawer-summary');
  const drawerSnsSection = document.getElementById('drawer-sns-section');
  const drawerCountX = document.getElementById('drawer-count-x');
  const drawerCountThreads = document.getElementById('drawer-count-threads');
  const drawerCountHatebu = document.getElementById('drawer-count-hatebu');
  const drawerSourcesList = document.getElementById('drawer-sources-list');

  // --- 1. 時計表示の更新 (日本時間) ---
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  function updateClock() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const day = weekDays[now.getDay()];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    clockElement.textContent = `${year}年${month}月${date}日 (${day}) ${hours}:${minutes}:${seconds}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // --- 2. テーマ切り替え機能 (ダーク/ライト) ---
  const savedTheme = localStorage.getItem('theme') || 'dark-theme';
  document.body.className = savedTheme;

  themeToggle.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
      document.body.className = 'light-theme';
      localStorage.setItem('theme', 'light-theme');
    } else {
      document.body.className = 'dark-theme';
      localStorage.setItem('theme', 'dark-theme');
    }
  });

  // --- 2.5 未読のみ表示モード初期設定 ＆ トグル処理 ---
  if (unreadOnlyMode) {
    document.body.classList.add('show-unread-only');
    unreadOnlyToggle.classList.add('active');
  }

  unreadOnlyToggle.addEventListener('click', () => {
    unreadOnlyMode = !unreadOnlyMode;
    localStorage.setItem('unreadOnlyMode', unreadOnlyMode);
    
    if (unreadOnlyMode) {
      document.body.classList.add('show-unread-only');
      unreadOnlyToggle.classList.add('active');
    } else {
      document.body.classList.remove('show-unread-only');
      unreadOnlyToggle.classList.remove('active');
    }
  });

  // --- 3. データ取得 ＆ 描画ロジック ---
  async function loadData(forceRefresh = false) {
    try {
      const response = await fetch('data.json?t=' + Date.now());
      if (!response.ok) throw new Error('データの取得に失敗しました');
      
      const data = await response.json();
      dashboardData = data;
      
      // 更新日時が同じなら描画をスキップ (強制時以外)
      if (!forceRefresh && lastTimestamp === data.timestamp) {
        return;
      }
      
      lastTimestamp = data.timestamp;
      
      // 同期日時の表示更新
      const syncDate = new Date(data.timestamp);
      lastSyncElement.textContent = `同期: ${String(syncDate.getHours()).padStart(2, '0')}:${String(syncDate.getMinutes()).padStart(2, '0')}:${String(syncDate.getSeconds()).padStart(2, '0')}`;
      
      // 描画実行
      renderHeadline(data.headline);
      renderTopNews(data.topNews);
      renderTrendingNews(data.trendingNews);
      renderSportsNews(data.sports);
      renderTicker(data);
      fetchAndRenderCuratedNews();

    } catch (err) {
      console.error('Data load error:', err.message);
    }
  }

  // A. ヘッドライン描画
  function renderHeadline(headline) {
    if (!headline) return;
    headlineTitle.textContent = headline.title;
    headlineSource.textContent = headline.sources[0]?.publisher || '速報ソース';
    
    // 未読・既読状態の判定
    const readHeadline = localStorage.getItem('read_headline');
    const isRead = readHeadline === headline.title;

    if (isRead) {
      headlineBar.classList.remove('unread');
      headlineBar.classList.add('read');
    } else {
      headlineBar.classList.remove('read');
      headlineBar.classList.add('unread');
    }

    // クリックイベントの登録 (バー全体)
    const handleHeadlineClick = () => {
      // 既読状態をローカルに保存
      localStorage.setItem('read_headline', headline.title);
      headlineBar.classList.remove('unread');
      headlineBar.classList.add('read');
      
      openDrawer({
        category: '速報',
        aiTitle: headline.title,
        aiSummary: headline.summary,
        sources: headline.sources,
        sns: null,
        emotion: 'hot'
      });
    };

    headlineBar.onclick = handleHeadlineClick;
    headlineDetailBtn.onclick = (e) => {
      e.stopPropagation(); // 親要素(headlineBar)のクリックイベント重複発火を防止
      handleHeadlineClick();
    };
  }

  // B. トップニュース描画
  function renderTopNews(topNews) {
    topNewsList.innerHTML = '';
    if (!topNews || topNews.length === 0) {
      topNewsList.innerHTML = '<div class="loading-placeholder">ニュースがありません。</div>';
      return;
    }

    // ジャンルでフィルタリング
    const filteredNews = currentTopNewsTab === 'all'
      ? topNews
      : topNews.filter(item => item.genre === currentTopNewsTab);

    if (filteredNews.length === 0) {
      topNewsList.innerHTML = '<div class="loading-placeholder">このジャンルのニュースはありません。</div>';
      return;
    }

    filteredNews.forEach(item => {
      const card = document.createElement('article');
      const defaultUrl = item.sources[0]?.url || '#';
      const isRead = readNewsUrls.has(defaultUrl);
      
      card.className = `news-card fade-in${isRead ? ' is-read' : ''}`;
      card.innerHTML = `
        <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.aiTitle}</h4>
        <div class="card-meta">
          <div class="source-comparison">
            <span class="source-badge">${item.sources[0]?.publisher || '一次ソース'}</span>
            ${item.sources.length > 1 ? `<span class="source-badge">他 ${item.sources.length - 1} 社</span>` : ''}
          </div>
          ${addCardActionsHtml(defaultUrl, item.aiTitle)}
        </div>
      `;
      
      card.addEventListener('click', () => {
        markAsRead(defaultUrl, card);
        openDrawer({
          category: 'トップニュース',
          aiTitle: item.aiTitle,
          aiSummary: item.aiSummary,
          sources: item.sources,
          sns: { hatebu: item.hatebu, x: Math.floor(item.hatebu * 6.5), threads: Math.floor(item.hatebu * 1.2) },
          emotion: 'approved'
        });
      });
      
      bindCardActions(card);
      topNewsList.appendChild(card);
    });
  }

  // B-2. キュレーション（ニュース）ニュースのロードと描画
  async function fetchAndRenderCuratedNews() {
    if (!curatedNewsList) return;
    curatedNewsList.innerHTML = '<div class="loading-placeholder">ニュースを取得中...</div>';
    
    try {
      const response = await fetch('/api/curated?hours=48&limit=30');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      renderCuratedNews(data.items);
    } catch (err) {
      console.error('ニュースの取得失敗:', err.message);
      curatedNewsList.innerHTML = '<div class="loading-placeholder">ニュースの取得に失敗しました。</div>';
    }
  }

  // B-2-2. AIニュースまとめ（ダイジェスト）の取得と描画
  async function loadAIDigest() {
    try {
      const response = await fetch('/api/digest');
      const data = await response.json();

      if (!data.success) {
        aiDigestBanner.style.display = 'none';
        return;
      }

      renderAIDigest(data.digestType, data.data);
    } catch (err) {
      console.error('AI digest load error:', err.message);
      aiDigestBanner.style.display = 'none';
    }
  }

  // MarkdownをHTMLに変換する軽量パーサー
  function parseInlineMarkdown(text) {
    if (!text) return '';
    let html = text;
    // 太字: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // 斜体: *text* (太字と干渉しないよう非貪欲マッチ)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // コード: `code`
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    // リンク: [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return html;
  }

  function parseMarkdownToHtml(md) {
    if (!md) return '';
    const lines = md.split('\n');
    let result = [];
    let inList = false;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // 空行の処理
      if (line === '') {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        if (inTable) {
          result.push('</tbody></table></div>');
          inTable = false;
        }
        continue;
      }

      // テーブルの処理
      if (line.startsWith('|') && line.endsWith('|')) {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        const isDivider = cells.every(c => /^:?-+:?$/.test(c));
        
        if (isDivider) {
          continue;
        }

        if (!inTable) {
          result.push('<div class="table-responsive"><table class="ai-digest-table"><thead>');
          inTable = true;
          result.push('<tr>');
          cells.forEach(c => {
            result.push(`<th>${parseInlineMarkdown(c)}</th>`);
          });
          result.push('</tr></thead><tbody>');
        } else {
          result.push('<tr>');
          cells.forEach(c => {
            result.push(`<td>${parseInlineMarkdown(c)}</td>`);
          });
          result.push('</tr>');
        }
        continue;
      } else {
        if (inTable) {
          result.push('</tbody></table></div>');
          inTable = false;
        }
      }

      // リストの処理
      const listMatch = line.match(/^[\*\-]\s+(.*)$/);
      if (listMatch) {
        const content = listMatch[1];
        if (!inList) {
          result.push('<ul class="ai-digest-list">');
          inList = true;
        }
        result.push(`<li>${parseInlineMarkdown(content)}</li>`);
        continue;
      } else {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
      }

      // 見出しの処理
      const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const content = headerMatch[2];
        const targetLevel = Math.min(level + 3, 6); // H1 -> H4, H2 -> H5, H3 -> H6
        result.push(`<h${targetLevel}>${parseInlineMarkdown(content)}</h${targetLevel}>`);
        continue;
      }

      // 通常の段落
      result.push(`<p>${parseInlineMarkdown(line)}</p>`);
    }

    if (inList) {
      result.push('</ul>');
    }
    if (inTable) {
      result.push('</tbody></table></div>');
    }

    return result.join('\n');
  }

  function renderAIDigest(type, digestData) {
    if (!digestData) {
      aiDigestBanner.style.display = 'none';
      return;
    }

    let badgeText = '夜刊';
    if (type === 'morning') {
      badgeText = '朝刊';
    } else if (type === 'noon') {
      badgeText = '昼刊';
    }

    // バナーのテキストを更新して表示
    aiDigestBadge.textContent = badgeText;
    aiDigestBanner.className = `ai-digest-banner ${type}`;
    aiDigestBanner.style.display = 'flex';

    // スマホ表示用のテキスト設定
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      aiDigestOpenBtn.textContent = `${badgeText}を読む`;
    } else {
      aiDigestOpenBtn.textContent = 'ダイジェストを読む';
    }

    // パース処理
    let bodyHtml = '';
    if (digestData.markdownContent) {
      bodyHtml = parseMarkdownToHtml(digestData.markdownContent);
    } else if (digestData.topics) {
      bodyHtml = digestData.topics.map(topic => `
        <div class="ai-digest-topic">
          <h4>${topic.topicTitle}</h4>
          <p>${topic.topicSummary}</p>
        </div>
      `).join('');
    }

    // モーダルを開く処理
    const openModal = () => {
      aiDigestModalBody.innerHTML = bodyHtml;
      aiDigestModal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // 背面スクロールの防止
    };

    // モーダルを閉じる処理
    const closeModal = () => {
      aiDigestModal.style.display = 'none';
      document.body.style.overflow = ''; // スクロールの復帰
    };

    aiDigestOpenBtn.onclick = (e) => {
      e.stopPropagation();
      openModal();
    };

    // バナー全体をクリックしても開くようにする
    aiDigestBanner.onclick = () => {
      openModal();
    };

    // クローズイベント
    aiDigestModalCloseBtn.onclick = (e) => {
      e.stopPropagation();
      closeModal();
    };

    aiDigestModalOverlay.onclick = (e) => {
      e.stopPropagation();
      closeModal();
    };

    // ESCキーで閉じる
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && aiDigestModal.style.display === 'flex') {
        closeModal();
      }
    });
  }


  // B-3. キュレーション（ニュース）ニュースの描画
  function renderCuratedNews(items) {
    if (!curatedNewsList) return;
    
    // データソースの保持
    if (items) {
      curatedNewsItems = items;
    }
    
    curatedNewsList.innerHTML = '';
    
    if (!curatedNewsItems || curatedNewsItems.length === 0) {
      curatedNewsList.innerHTML = '<div class="loading-placeholder">現在、ニュースはありません。</div>';
      return;
    }

    curatedNewsItems.forEach(item => {
      const card = document.createElement('article');
      const defaultUrl = item.link || '#';
      const isRead = readNewsUrls.has(defaultUrl);
      
      card.className = `news-card fade-in${isRead ? ' is-read' : ''}`;
      
      // 注目度スコア（数値のみ・単色）の設定
      const scoreNum = Number(item.score);
      const formattedScore = scoreNum.toFixed(2);
      let badgeClass = 'score-level-d';
      
      if (scoreNum >= 85) {
        badgeClass = 'score-level-s';
      } else if (scoreNum >= 70) {
        badgeClass = 'score-level-a';
      } else if (scoreNum >= 50) {
        badgeClass = 'score-level-b';
      } else if (scoreNum >= 25) {
        badgeClass = 'score-level-c';
      }
      
      const scoreBadgeHtml = `<span class="source-badge score-badge ${badgeClass}">${formattedScore}</span>`;
      const categoryBadgeHtml = item.category ? `<span class="source-badge category-badge">${item.category}</span>` : '';
      
      const sources = item.metadata?.sources || [{ publisher: item.feed_name, title: item.title, url: item.link }];
      const publisherName = sources[0]?.publisher || item.feed_name || '一次ソース';
      const otherSourcesCount = sources.length - 1;

      card.innerHTML = `
        <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.title}</h4>
        <div class="card-meta">
          <div class="source-comparison">
            ${scoreBadgeHtml}
            ${categoryBadgeHtml}
            <span class="source-badge">${publisherName}</span>
            ${otherSourcesCount > 0 ? `<span class="source-badge">他 ${otherSourcesCount} 社</span>` : ''}
          </div>
          ${addCardActionsHtml(defaultUrl, item.title)}
        </div>
      `;
      
      card.addEventListener('click', () => {
        markAsRead(defaultUrl, card);
        const emotion = item.emotion || 'approved';
        
        openDrawer({
          category: 'ニュース',
          aiTitle: item.title,
          aiSummary: item.summary || '詳細記事を参照してください。',
          sources: sources,
          sns: { hatebu: item.hatebu, x: item.x_count, threads: item.threads_count },
          emotion: emotion
        });
      });
      
      bindCardActions(card);
      curatedNewsList.appendChild(card);
    });
  }

  // C. 話題 of ニュース描画 (感情SVG・SNSバッジ付き)
  function renderTrendingNews(trendingNews) {
    trendingNewsList.innerHTML = '';
    if (!trendingNews || trendingNews.length === 0) {
      trendingNewsList.innerHTML = '<div class="loading-placeholder">話題がありません。</div>';
      return;
    }

    // ジャンルでフィルタリング
    const filteredTrending = currentTrendingNewsTab === 'all'
      ? trendingNews
      : trendingNews.filter(item => item.genre === currentTrendingNewsTab);

    if (filteredTrending.length === 0) {
      trendingNewsList.innerHTML = '<div class="loading-placeholder">このジャンルの話題はありません。</div>';
      return;
    }

    filteredTrending.forEach(item => {
      const card = document.createElement('article');
      const defaultUrl = item.sources[0]?.url || '#';
      const isRead = readNewsUrls.has(defaultUrl);
      
      card.className = `news-card fade-in${isRead ? ' is-read' : ''}`;
      
      // 感情名日本語マッピング
      const emotionNames = {
        hot: '大注目',
        surprised: '驚き',
        funny: '面白い',
        sad: '懸念',
        approved: '賛同'
      };

      // 感情バッジHTML構築
      const emotionText = emotionNames[item.emotion] || '話題';
      const badgeClass = `${item.emotion}-badge`;
      
      card.innerHTML = `
        <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.aiTitle}</h4>
        <div class="card-meta">
          <div class="emotion-badge ${badgeClass}" id="badge-em-${item.id}">
            <!-- ここにSVGがインサートされます -->
            <span>${emotionText}</span>
          </div>
          <div class="sns-badge-row">
            <span class="sns-pill x">X: ${formatCount(item.sns.x)}</span>
            <span class="sns-pill threads">Threads: ${formatCount(item.sns.threads)}</span>
            <span class="sns-pill hatebu">B!: ${formatCount(item.sns.hatebu)}</span>
            ${addCardActionsHtml(defaultUrl, item.aiTitle)}
          </div>
        </div>
      `;

      // 感情SVGテンプレートをクローンしてカードに挿入
      const badgeContainer = card.querySelector(`#badge-em-${item.id}`);
      const templateSvg = document.getElementById(`svg-emotion-${item.emotion}`);
      if (templateSvg && badgeContainer) {
        const clonedSvg = templateSvg.cloneNode(true);
        clonedSvg.removeAttribute('id'); // ID重複を避ける
        badgeContainer.insertBefore(clonedSvg, badgeContainer.firstChild);
      }

      card.addEventListener('click', () => {
        markAsRead(defaultUrl, card);
        openDrawer({
          category: '話題のニュース',
          aiTitle: item.aiTitle,
          aiSummary: item.aiSummary,
          sources: item.sources,
          sns: item.sns,
          emotion: item.emotion
        });
      });

      bindCardActions(card);
      trendingNewsList.appendChild(card);
    });
  }

  // D. スポーツニュース描画
  function renderSportsNews(sportsData) {
    sportsNewsList.innerHTML = '';
    if (!sportsData) return;
    
    // 1. 試合状況（スコアボード）の描画
    if (dashboardData && dashboardData.sportsGamesState) {
      const activeGames = dashboardData.sportsGamesState.filter(game => {
        if (currentSportsTab === 'baseball' && game.type === 'baseball') return true;
        if (currentSportsTab === 'mlb' && game.type === 'mlb') return true;
        if (currentSportsTab === 'soccer' && game.type === 'soccer') return true;
        return false;
      });

      if (activeGames.length > 0) {
        const slider = document.createElement('div');
        slider.className = 'sports-games-slider';

        activeGames.forEach(game => {
          const isLive = game.status === 'live';
          const isFinished = game.status === 'finished';
          
          const card = document.createElement('div');
          card.className = 'game-score-card';
          card.innerHTML = `
            <div class="game-card-header">
              <span class="game-status-label">${game.detail}</span>
              ${isLive ? '<span class="game-live-badge"><span class="pulse-dot"></span>LIVE</span>' : ''}
              ${isFinished ? '<span class="game-status-label" style="color:var(--text-muted);">終了</span>' : ''}
            </div>
            <div class="game-card-body">
              <div class="game-team-row">
                <span class="game-team-name">${game.away}</span>
                <span class="game-team-score">${game.awayScore}</span>
              </div>
              <div class="game-team-row">
                <span class="game-team-name">${game.home}</span>
                <span class="game-team-score">${game.homeScore}</span>
              </div>
            </div>
            <div class="game-card-footer">
              <div class="game-commentary-text" title="${game.commentary}">${game.commentary}</div>
            </div>
          `;
          slider.appendChild(card);
        });

        sportsNewsList.appendChild(slider);
      }
    }

    const activeData = sportsData[currentSportsTab] || [];
    
    if (activeData.length === 0) {
      const hasGames = sportsNewsList.children.length > 0;
      if (!hasGames) {
        sportsNewsList.innerHTML = '<div class="loading-placeholder">ニュースがありません。</div>';
      }
      return;
    }

    activeData.forEach(item => {
      const card = document.createElement('article');
      const defaultUrl = item.sources[0]?.url || '#';
      const isRead = readNewsUrls.has(defaultUrl);
      
      card.className = `news-card fade-in${isRead ? ' is-read' : ''}`;
      card.innerHTML = `
        <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.aiTitle}</h4>
        <div class="card-meta">
          <div class="source-comparison">
            <span class="source-badge">${item.sources[0]?.publisher || 'スポーツ紙'}</span>
            ${item.sources.length > 1 ? `<span class="source-badge">他 ${item.sources.length - 1} 社</span>` : ''}
          </div>
          ${addCardActionsHtml(defaultUrl, item.aiTitle)}
        </div>
      `;
      
      card.addEventListener('click', () => {
        markAsRead(defaultUrl, card);
        openDrawer({
          category: `スポーツ (${getSportLabel(currentSportsTab)})`,
          aiTitle: item.aiTitle,
          aiSummary: item.aiSummary,
          sources: item.sources,
          sns: null,
          emotion: 'hot'
        });
      });

      bindCardActions(card);
      sportsNewsList.appendChild(card);
    });
  }

  // (イベントスケジュール描画関数は不要のため廃止されました)

  // F. 下部ニュースカルーセル描画
  function renderTicker(data) {
    carouselTrack.innerHTML = '';
    const tickerItems = [];
    
    // 一般ニュース
    data.topNews.forEach(n => {
      tickerItems.push({
        source: n.sources[0]?.publisher || '主要',
        title: n.aiTitle,
        item: {
          category: 'トップニュース',
          aiTitle: n.aiTitle,
          aiSummary: n.aiSummary,
          sources: n.sources,
          sns: { hatebu: n.hatebu, x: Math.floor(n.hatebu * 6.5), threads: Math.floor(n.hatebu * 1.2) },
          emotion: 'approved'
        }
      });
    });

    // 話題のニュース
    data.trendingNews.forEach(n => {
      tickerItems.push({
        source: n.sources[0]?.publisher || '話題',
        title: n.aiTitle,
        item: {
          category: '話題のニュース',
          aiTitle: n.aiTitle,
          aiSummary: n.aiSummary,
          sources: n.sources,
          sns: n.sns,
          emotion: n.emotion
        }
      });
    });

    // スポーツ
    Object.keys(data.sports).forEach(sportKey => {
      data.sports[sportKey].forEach(n => {
        const sportLabel = getSportLabel(sportKey);
        tickerItems.push({
          source: sportLabel,
          title: n.aiTitle,
          item: {
            category: `スポーツ (${sportLabel})`,
            aiTitle: n.aiTitle,
            aiSummary: n.aiSummary,
            sources: n.sources,
            sns: null,
            emotion: 'hot'
          }
        });
      });
    });

    if (tickerItems.length === 0) {
      carouselTrack.innerHTML = '<div class="loading-placeholder-mini">現在、速報ニュースはありません。</div>';
      return;
    }

    tickerItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'ticker-mini-card';
      card.innerHTML = `
        <span class="card-source">${item.source}</span>
        <span class="card-title">${item.title}</span>
      `;
      
      card.addEventListener('click', () => {
        openDrawer(item.item);
      });
      
      carouselTrack.appendChild(card);
    });

    // カルーセルの初期化・再起動
    initCarousel();
  }

  // --- 4. 詳細表示ドロワーの開閉 ＆ データ注入 ---
  function openDrawer(item) {
    closeBookmarkDrawer(); // 左ドロワーが開いていたら閉じる
    drawerCategory.textContent = item.category;
    drawerTitle.textContent = item.aiTitle;
    drawerSummary.textContent = item.aiSummary;

    // 感情表示設定
    drawerEmotionWrap.innerHTML = '';
    if (item.sns) {
      const emotionNames = { hot: '大注目', surprised: '驚き', funny: '面白い', sad: '懸念', approved: '賛同' };
      const badge = document.createElement('div');
      badge.className = `emotion-badge ${item.emotion}-badge`;
      badge.innerHTML = `<span>${emotionNames[item.emotion] || '話題'}</span>`;
      
      const templateSvg = document.getElementById(`svg-emotion-${item.emotion}`);
      if (templateSvg) {
        const clonedSvg = templateSvg.cloneNode(true);
        clonedSvg.removeAttribute('id');
        badge.insertBefore(clonedSvg, badge.firstChild);
      }
      drawerEmotionWrap.appendChild(badge);
    }

    // SNSカウンター設定 (話題の場合のみ表示)
    if (item.sns) {
      drawerSnsSection.style.display = 'block';
      drawerCountX.textContent = formatCount(item.sns.x);
      drawerCountThreads.textContent = formatCount(item.sns.threads);
      drawerCountHatebu.textContent = formatCount(item.sns.hatebu);
    } else {
      drawerSnsSection.style.display = 'none';
    }

    // メディア比較リンクの構築
    drawerSourcesList.innerHTML = '';
    if (!item.sources || item.sources.length === 0) {
      drawerSourcesList.innerHTML = '<div class="loading-placeholder">詳細ソース記事がありません。</div>';
    } else {
      item.sources.forEach(src => {
        const linkCard = document.createElement('a');
        linkCard.href = src.url;
        linkCard.target = '_blank';
        linkCard.rel = 'noopener noreferrer';
        linkCard.className = 'source-link-card';
        linkCard.innerHTML = `
          <div class="source-card-header">
            <span class="source-publisher">${src.publisher}</span>
            <!-- 外部リンク用矢印アイコン -->
            <svg class="arrow-icon icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="source-original-title">${src.title}</div>
        `;
        drawerSourcesList.appendChild(linkCard);
      });
    }

    // ドロワー表示
    detailDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
    detailDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    detailDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    detailDrawer.setAttribute('aria-hidden', 'true');
  }

  drawerClose.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  // --- 5. スポーツタブの切り替え ---
  sportsTabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-btn')) return;
    
    // アクティブなボタンの切り替え
    sportsTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    // データ切り替え
    currentSportsTab = e.target.dataset.tab;
    if (dashboardData) {
      renderSportsNews(dashboardData.sports);
    }
  });

  // --- 5-2. トップニュースタブの切り替え ---
  topNewsTabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-btn')) return;
    
    topNewsTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    currentTopNewsTab = e.target.dataset.tab;
    if (dashboardData) {
      renderTopNews(dashboardData.topNews);
    }
  });

  // --- 5-3. 話題のニュースタブの切り替え ---
  trendingNewsTabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-btn')) return;
    
    trendingNewsTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    currentTrendingNewsTab = e.target.dataset.tab;
    if (dashboardData) {
      renderTrendingNews(dashboardData.trendingNews);
    }
  });

  // --- 6. 手動更新ボタン (API呼び出し) ---
  refreshBtn.addEventListener('click', async () => {
    // スピンアニメーション適用・二重送信防止
    const icon = refreshBtn.querySelector('.icon');
    icon.classList.add('spin');
    refreshBtn.disabled = true;
    
    try {
      const response = await fetch('/api/refresh');
      const data = await response.json();
      
      if (data.success) {
        // 更新成功後、即時データを描画更新
        await loadData(true);
        await loadAIDigest();
      } else {
        alert('同期に失敗しました: ' + (data.error || '不明なエラー'));
      }
    } catch (e) {
      alert('サーバー通信に失敗しました。');
    } finally {
      // アニメーション解除
      icon.classList.remove('spin');
      refreshBtn.disabled = false;
    }
  });

  // --- ヘルパー関数 ---
  function formatCount(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num;
  }

  function getSportLabel(tab) {
    const labels = {
      baseball: 'プロ野球',
      mlb: 'MLB',
      soccer: '海外サッカー',
      seasonal: '大会・季節'
    };
    return labels[tab] || '';
  }

  // 記事を既読状態にする
  function markAsRead(url, cardElement) {
    if (!url || url === '#') return;
    if (!readNewsUrls.has(url)) {
      readNewsUrls.add(url);
      localStorage.setItem('readNewsUrls', JSON.stringify([...readNewsUrls]));
      if (cardElement) {
        cardElement.classList.add('is-read');
        const dot = cardElement.querySelector('.unread-dot');
        if (dot) dot.remove();
      }
    }
  }

  // カード内アクションボタン（シェア ＆ ブックマーク）のHTML
  function addCardActionsHtml(defaultUrl, title) {
    if (!defaultUrl || defaultUrl === '#') return '';
    const isBookmarked = userBookmarks.has(defaultUrl);
    return `
      <div class="card-actions">
        <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" title="あとで読む" data-id="${defaultUrl}">
          <svg viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="card-action-btn share-btn" title="共有する" data-url="${defaultUrl}" data-title="${title}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7L15.96 7.3c.51.48 1.2.78 1.96.78 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.53 9.33 6.84 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.84 0 1.53-.33 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
        </button>
      </div>
    `;
  }

  function bindCardActions(cardElement) {
    const shareBtn = cardElement.querySelector('.share-btn');
    const bookmarkBtn = cardElement.querySelector('.bookmark-btn');
    
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const articleId = bookmarkBtn.dataset.id;
        toggleBookmark(articleId, bookmarkBtn);
      });
    }
    
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // 既存のシェアポップアップがあれば削除
        removeActiveSharePopup();
        
        const url = shareBtn.dataset.url;
        const title = shareBtn.dataset.title;
        
        // ポップアップを生成
        const popup = document.createElement('div');
        popup.className = 'share-popup';
        popup.id = 'active-share-popup';
        
        popup.innerHTML = `
          <button class="share-popup-item x-share-item">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span>Xでシェア</span>
          </button>
          <button class="share-popup-item line-share-item">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.564.39.084.922.258 1.057.592.12.303.079.778.038 1.082l-.169 1.022c-.051.306-.245 1.196 1.057.653 1.302-.543 7.022-4.135 9.579-7.079 2.278-2.617 3.402-5.148 3.402-7.834z"/></svg>
            <span>LINEで送る</span>
          </button>
          <button class="share-popup-item copy-link-item">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
            <span class="copy-text">リンクをコピー</span>
          </button>
        `;
        
        document.body.appendChild(popup);
        
        // 位置の計算
        const rect = shareBtn.getBoundingClientRect();
        const popupHeight = 110;
        const popupWidth = 150;
        
        let top = rect.bottom + window.scrollY + 6;
        let left = rect.right + window.scrollX - popupWidth;
        
        // 画面の下端からはみ出る場合は、ボタンの上に表示
        if (top - window.scrollY + popupHeight > window.innerHeight) {
          top = rect.top + window.scrollY - popupHeight - 6;
        }
        
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
        
        // フェードイン表示
        requestAnimationFrame(() => {
          popup.classList.add('show');
        });
        
        // Xでシェア
        popup.querySelector('.x-share-item').addEventListener('click', (ev) => {
          ev.stopPropagation();
          const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
          window.open(xUrl, '_blank', 'noopener,noreferrer');
          removeActiveSharePopup();
        });
        
        // LINEで送る
        popup.querySelector('.line-share-item').addEventListener('click', (ev) => {
          ev.stopPropagation();
          const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
          window.open(lineUrl, '_blank', 'noopener,noreferrer');
          removeActiveSharePopup();
        });
        
        // コピー
        popup.querySelector('.copy-link-item').addEventListener('click', async (ev) => {
          ev.stopPropagation();
          try {
            await navigator.clipboard.writeText(url);
            const itemBtn = popup.querySelector('.copy-link-item');
            const textSpan = itemBtn.querySelector('.copy-text');
            itemBtn.classList.add('copied');
            textSpan.textContent = 'コピー完了！';
            
            setTimeout(() => {
              removeActiveSharePopup();
            }, 800);
          } catch (err) {
            console.error('Failed to copy link:', err);
            alert('コピーに失敗しました。');
          }
        });
      });
    }
  }

  // 日本の主要都市・都道府県庁所在地の座標情報
  const MAJOR_CITIES = [
    { name: '札幌', lat: 43.0621, lon: 141.3544, region: '北海道', pref: '北海道' },
    { name: '青森', lat: 40.8244, lon: 140.7476, region: '東北', pref: '青森' },
    { name: '盛岡', lat: 39.7036, lon: 141.1527, region: '東北', pref: '岩手' },
    { name: '仙台', lat: 38.2682, lon: 140.8694, region: '東北', pref: '宮城' },
    { name: '秋田', lat: 39.7186, lon: 140.1024, region: '東北', pref: '秋田' },
    { name: '山形', lat: 38.2404, lon: 140.3633, region: '東北', pref: '山形' },
    { name: '福島', lat: 37.7503, lon: 140.4676, region: '東北', pref: '福島' },
    { name: '水戸', lat: 36.3659, lon: 140.4712, region: '関東', pref: '茨城' },
    { name: '宇都宮', lat: 36.5658, lon: 139.8836, region: '関東', pref: '栃木' },
    { name: '前橋', lat: 36.3895, lon: 139.0634, region: '関東', pref: '群馬' },
    { name: 'さいたま', lat: 35.8617, lon: 139.6455, region: '関東', pref: '埼玉' },
    { name: '千葉', lat: 35.6073, lon: 140.1065, region: '関東', pref: '千葉' },
    { name: '東京', lat: 35.6895, lon: 139.6917, region: '関東', pref: '東京' },
    { name: '横浜', lat: 35.4437, lon: 139.6380, region: '関東', pref: '神奈川' },
    { name: '川崎', lat: 35.5302, lon: 139.7029, region: '関東', pref: '神奈川' },
    { name: '相模原', lat: 35.5714, lon: 139.3739, region: '関東', pref: '神奈川' },
    { name: '新潟', lat: 37.9162, lon: 139.0364, region: '中部', pref: '新潟' },
    { name: '富山', lat: 36.6953, lon: 137.2113, region: '中部', pref: '富山' },
    { name: '金沢', lat: 36.5613, lon: 136.6562, region: '中部', pref: '石川' },
    { name: '福井', lat: 36.0641, lon: 136.2196, region: '中部', pref: '福井' },
    { name: '甲府', lat: 35.6622, lon: 138.5683, region: '中部', pref: '山梨' },
    { name: '長野', lat: 36.6486, lon: 138.1942, region: '中部', pref: '長野' },
    { name: '岐阜', lat: 35.4233, lon: 136.7607, region: '中部', pref: '岐阜' },
    { name: '静岡', lat: 34.9756, lon: 138.3831, region: '中部', pref: '静岡' },
    { name: '浜松', lat: 34.7108, lon: 137.7261, region: '中部', pref: '静岡' },
    { name: '名古屋', lat: 35.1815, lon: 136.9066, region: '中部', pref: '愛知' },
    { name: '津', lat: 34.7186, lon: 136.5053, region: '中部', pref: '三重' },
    { name: '大津', lat: 35.0178, lon: 135.8547, region: '近畿', pref: '滋賀' },
    { name: '京都', lat: 35.0116, lon: 135.7681, region: '近畿', pref: '京都' },
    { name: '大阪', lat: 34.6937, lon: 135.5023, region: '近畿', pref: '大阪' },
    { name: '堺', lat: 34.5735, lon: 135.4830, region: '近畿', pref: '大阪' },
    { name: '神戸', lat: 34.6901, lon: 135.1955, region: '近畿', pref: '兵庫' },
    { name: '奈良', lat: 34.6851, lon: 135.8050, region: '近畿', pref: '奈良' },
    { name: '和歌山', lat: 34.2300, lon: 135.1708, region: '近畿', pref: '和歌山' },
    { name: '鳥取', lat: 35.5011, lon: 134.2351, region: '中国', pref: '鳥取' },
    { name: '松江', lat: 35.4681, lon: 133.0484, region: '中国', pref: '島根' },
    { name: '岡山', lat: 34.6551, lon: 133.9196, region: '中国', pref: '岡山' },
    { name: '広島', lat: 34.3853, lon: 132.4553, region: '中国', pref: '広島' },
    { name: '山口', lat: 34.1785, lon: 131.4737, region: '中国', pref: '山口' },
    { name: '徳島', lat: 34.0711, lon: 134.5516, region: '四国', pref: '徳島' },
    { name: '高松', lat: 34.3428, lon: 134.0466, region: '四国', pref: '香川' },
    { name: '松山', lat: 33.8392, lon: 132.7653, region: '四国', pref: '愛媛' },
    { name: '高知', lat: 33.5597, lon: 133.5311, region: '四国', pref: '高知' },
    { name: '北九州', lat: 33.8835, lon: 130.8752, region: '九州', pref: '福岡' },
    { name: '福岡', lat: 33.5904, lon: 130.4017, region: '九州', pref: '福岡' },
    { name: '佐賀', lat: 33.2635, lon: 130.3009, region: '九州', pref: '佐賀' },
    { name: '長崎', lat: 32.7501, lon: 129.8773, region: '九州', pref: '長崎' },
    { name: '熊本', lat: 32.8031, lon: 130.7079, region: '九州', pref: '熊本' },
    { name: '大分', lat: 33.2382, lon: 131.6069, region: '九州', pref: '大分' },
    { name: '宮崎', lat: 31.9077, lon: 131.4202, region: '九州', pref: '宮崎' },
    { name: '鹿児島', lat: 31.5966, lon: 130.5571, region: '九州', pref: '鹿児島' },
    { name: '那覇', lat: 26.2124, lon: 127.6809, region: '沖縄', pref: '沖縄' }
  ];

  // 緯度経度から最も近い主要都市の名前を割り出すヘルパー
  function getNearestCity(lat, lon) {
    let nearest = MAJOR_CITIES[12]; // デフォルト東京
    let minDistance = Infinity;

    for (const city of MAJOR_CITIES) {
      // 簡易直線距離計算
      const dLat = city.lat - lat;
      const dLon = city.lon - lon;
      const dist = dLat * dLat + dLon * dLon;
      
      if (dist < minDistance) {
        minDistance = dist;
        nearest = city;
      }
    }
    return nearest;
  }

  // --- 7. 天気情報取得ロジック (Open-Meteo) ---
  function initWeather() {
    const weatherElement = document.getElementById('weather-display');
    if (!navigator.geolocation) {
      weatherElement.textContent = '位置情報非対応';
      fetchWeather(currentCity.lat, currentCity.lon, currentCity);
      return;
    }

    fetchWeather(currentCity.lat, currentCity.lon, currentCity);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        currentCity = getNearestCity(lat, lon);
        fetchWeather(lat, lon, currentCity);
      },
      (error) => {
        console.log('位置情報の取得に失敗しました。デフォルト表示（東京）を使用します:', error.message);
        fetchWeather(currentCity.lat, currentCity.lon, currentCity);
      }
    );
  }

  async function fetchWeather(lat, lon, cityObj) {
    const cityElement = document.getElementById('weather-city');
    const infoElement = document.getElementById('weather-info');
    const forecastList = document.getElementById('forecast-list');
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode&timezone=Asia%2FTokyo`);
      if (!response.ok) throw new Error('天気データの取得に失敗しました');
      const data = await response.json();
      
      const temp = Math.round(data.current_weather.temperature);
      const code = data.current_weather.weathercode;

      const weatherMap = {
        0: { text: '快晴', icon: '☀️' },
        1: { text: '晴れ', icon: '☀️' },
        2: { text: '晴れ', icon: '🌤️' },
        3: { text: '曇り', icon: '☁️' },
        45: { text: '霧', icon: '🌫️' },
        48: { text: '霧', icon: '🌫️' },
        51: { text: '小雨', icon: '🌧️' },
        53: { text: '雨', icon: '🌧️' },
        55: { text: '雨', icon: '🌧️' },
        61: { text: '雨', icon: '☔' },
        63: { text: '雨', icon: '☔' },
        65: { text: '大雨', icon: '☔' },
        71: { text: '雪', icon: '❄️' },
        73: { text: '雪', icon: '❄️' },
        75: { text: '大雪', icon: '❄️' },
        80: { text: 'にわか雨', icon: '🌧️' },
        81: { text: 'にわか雨', icon: '🌧️' },
        82: { text: '激しい雨', icon: '☔' },
        95: { text: '雷雨', icon: '⚡' }
      };

      const state = weatherMap[code] || { text: '曇りがち', icon: '🌤️' };
      cityElement.textContent = `📍${cityObj.name}:`;
      infoElement.innerHTML = `<span class="weather-emoji">${state.icon}</span> <span>${state.text}</span> <span>${temp}°C</span>`;

      // 3時間ごとの時間別予報の構築
      forecastList.innerHTML = '';
      const nowTimeStr = data.current_weather.time;
      const hourlyTimes = data.hourly.time;
      let currentIndex = hourlyTimes.findIndex(t => t >= nowTimeStr);
      if (currentIndex === -1) currentIndex = 0;

      for (let i = 1; i <= 4; i++) {
        const targetIndex = currentIndex + (i * 3);
        if (targetIndex >= hourlyTimes.length) break;

        const timeVal = new Date(hourlyTimes[targetIndex]);
        const timeLabel = `${timeVal.getHours()}:00`;
        const tempVal = Math.round(data.hourly.temperature_2m[targetIndex]);
        const codeVal = data.hourly.weathercode[targetIndex];
        const stateVal = weatherMap[codeVal] || { text: '曇り', icon: '☁️' };

        const item = document.createElement('div');
        item.className = 'forecast-item';
        item.innerHTML = `
          <span class="forecast-time">${timeLabel}</span>
          <span class="forecast-icon">${stateVal.icon}</span>
          <span class="forecast-temp">${tempVal}°C</span>
        `;
        forecastList.appendChild(item);
      }
    } catch (e) {
      console.error('Weather fetch error:', e.message);
      cityElement.textContent = '📍天気エラー';
      infoElement.innerHTML = '';
    }
  }

  // --- 8. フッターカルーセルの制御ロジック ---
  let itemsPerView = 3;

  function updateItemsPerView() {
    const width = window.innerWidth;
    if (width <= 768) {
      itemsPerView = 1;
    } else if (width <= 1200) {
      itemsPerView = 2;
    } else {
      itemsPerView = 3;
    }
  }

  function initCarousel() {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselIndex = 0;
    slideCarousel(0);
    startCarouselAutoPlay();
  }

  function slideCarousel(index) {
    const cards = carouselTrack.querySelectorAll('.ticker-mini-card');
    if (cards.length === 0) return;
    
    updateItemsPerView();
    const maxIndex = Math.max(0, cards.length - itemsPerView);
    
    if (index < 0) {
      carouselIndex = maxIndex;
    } else if (index > maxIndex) {
      carouselIndex = 0;
    } else {
      carouselIndex = index;
    }

    const cardWidth = cards[0].offsetWidth;
    const offset = carouselIndex * (cardWidth + 16);
    carouselTrack.style.transform = `translateX(-${offset}px)`;
  }

  function startCarouselAutoPlay() {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = setInterval(() => {
      slideCarousel(carouselIndex + 1);
    }, 5000);
  }

  function stopCarouselAutoPlay() {
    if (carouselTimer) {
      clearInterval(carouselTimer);
      carouselTimer = null;
    }
  }

  tickerPrevBtn.addEventListener('click', () => {
    stopCarouselAutoPlay();
    slideCarousel(carouselIndex - 1);
    startCarouselAutoPlay();
  });

  tickerNextBtn.addEventListener('click', () => {
    stopCarouselAutoPlay();
    slideCarousel(carouselIndex + 1);
    startCarouselAutoPlay();
  });

  footerContainer.addEventListener('mouseenter', stopCarouselAutoPlay);
  footerContainer.addEventListener('mouseleave', startCarouselAutoPlay);

  window.addEventListener('resize', () => {
    slideCarousel(carouselIndex);
  });

  // --- 8-2. 天気・地名ホバーポップアップ制御 ---
  const weatherCityWrapper = document.getElementById('weather-city-wrapper');
  const weatherInfoWrapper = document.getElementById('weather-info-wrapper');
  const cityNewsPopup = document.getElementById('city-news-popup');
  const weatherForecastPopup = document.getElementById('weather-forecast-popup');
  const cityNewsList = document.getElementById('city-news-list');

  weatherCityWrapper.addEventListener('mouseenter', () => {
    buildCityNews();
    cityNewsPopup.style.display = 'block';
  });

  weatherCityWrapper.addEventListener('mouseleave', () => {
    cityNewsPopup.style.display = 'none';
  });

  weatherInfoWrapper.addEventListener('mouseenter', () => {
    weatherForecastPopup.style.display = 'flex';
  });

  weatherInfoWrapper.addEventListener('mouseleave', () => {
    weatherForecastPopup.style.display = 'none';
  });

  function buildCityNews() {
    cityNewsList.innerHTML = '';
    if (!dashboardData) return;

    const regionName = currentCity.region;
    const prefName = currentCity.pref;

    // 地方名または都道府県名が含まれるニュースをフィルタリング
    let filteredNews = dashboardData.topNews.filter(n => {
      const text = (n.aiTitle + ' ' + n.aiSummary).toLowerCase();
      return text.includes(regionName.toLowerCase()) || text.includes(prefName.toLowerCase());
    });

    let isFallback = false;
    if (filteredNews.length === 0) {
      // 地方ニュースがなければ主要トップニュース3件をフォールバック
      filteredNews = dashboardData.topNews.slice(0, 3);
      isFallback = true;
    }

    const titleEl = cityNewsPopup.querySelector('.popup-title');
    titleEl.textContent = isFallback ? '全国の主要ニュース' : `${prefName}・${regionName}地方のニュース`;

    if (filteredNews.length === 0) {
      cityNewsList.innerHTML = '<div class="popup-news-empty">現在ニュースはありません。</div>';
      return;
    }

    filteredNews.slice(0, 3).forEach(n => {
      const item = document.createElement('div');
      item.className = 'popup-news-item';
      item.textContent = `・${n.aiTitle}`;
      item.title = n.aiTitle;
      
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        openDrawer({
          category: '地方ニュース',
          aiTitle: n.aiTitle,
          aiSummary: n.aiSummary,
          sources: n.sources,
          sns: { hatebu: n.hatebu, x: Math.floor(n.hatebu * 6.5), threads: Math.floor(n.hatebu * 1.2) },
          emotion: 'approved'
        });
      });
      cityNewsList.appendChild(item);
    });
  }

  // シェアポップアップ削除用のグローバルヘルパー
  function removeActiveSharePopup() {
    const existing = document.getElementById('active-share-popup');
    if (existing) {
      existing.id = 'removing-share-popup'; // 即座にIDを切り替えて競合を回避
      existing.classList.remove('show');
      setTimeout(() => {
        existing.remove();
      }, 200);
    }
  }

  // ドキュメントクリックでシェアポップアップを閉じる
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('active-share-popup');
    if (popup && !popup.contains(e.target)) {
      removeActiveSharePopup();
    }
  });

  // --- 10. 認証＆ブックマーク連携機能 ---

  // トースト通知の表示
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // アイコンの設定
    let iconHtml = 'ℹ️';
    if (type === 'success') iconHtml = '✅';
    if (type === 'warning') iconHtml = '⚠️';
    if (type === 'error') iconHtml = '❌';
    
    toast.innerHTML = `<span>${iconHtml}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    // 5秒後に自動消去
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4000);
  }

  // 認証モーダルの開閉
  let isSignUpMode = false;
  
  function openAuthModal(signUp = false) {
    isSignUpMode = signUp;
    authErrorMsg.style.display = 'none';
    authForm.reset();
    
    if (isSignUpMode) {
      authModalTitle.textContent = '新規アカウント作成';
      authSubmitBtn.textContent = '新規登録';
      authSwitchText.textContent = 'すでにアカウントをお持ちですか？';
      authSwitchBtn.textContent = 'ログイン';
    } else {
      authModalTitle.textContent = 'ログイン';
      authSubmitBtn.textContent = 'ログイン';
      authSwitchText.textContent = 'アカウントをお持ちでないですか？';
      authSwitchBtn.textContent = '新規登録';
    }
    
    authModal.style.display = 'flex';
  }

  function closeAuthModal() {
    authModal.style.display = 'none';
  }

  // ログイン・登録の切り替え
  authSwitchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal(!isSignUpMode);
  });

  authModalClose.addEventListener('click', closeAuthModal);
  authModalOverlay.addEventListener('click', closeAuthModal);

  // ログイン/登録の送信
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorMsg.style.display = 'none';
    authSubmitBtn.disabled = true;
    
    const email = authEmail.value;
    const password = authPassword.value;
    
    try {
      if (isSignUpMode) {
        // 新規登録
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        
        // Supabaseの自動サインイン設定によってサインイン状態になるか確認
        if (data.user && data.session) {
          showToast('新規登録およびログインに成功しました！', 'success');
          closeAuthModal();
        } else {
          showToast('確認メールを送信しました。メールをご確認ください。', 'success');
          closeAuthModal();
        }
      } else {
        // ログイン
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('ログインしました！', 'success');
        closeAuthModal();
      }
    } catch (err) {
      console.error('Auth error:', err.message);
      authErrorMsg.textContent = err.message || '認証エラーが発生しました。';
      authErrorMsg.style.display = 'block';
    } finally {
      authSubmitBtn.disabled = false;
    }
  });

  // ヘッダーログイン・ログアウトボタンの制御
  authBtn.addEventListener('click', async () => {
    if (currentUser) {
      // ログアウト処理
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        showToast('ログアウトに失敗しました: ' + error.message, 'error');
      } else {
        showToast('ログアウトしました。', 'info');
      }
    } else {
      // ログインモーダルを開く
      openAuthModal(false);
    }
  });

  // ブックマークデータのロード
  async function loadUserBookmarks() {
    if (!currentUser) {
      userBookmarks.clear();
      return;
    }
    
    try {
      const { data, error } = await supabaseClient
        .from('user_bookmarks')
        .select('article_id');
        
      if (error) throw error;
      
      userBookmarks.clear();
      if (data) {
        data.forEach(bookmark => {
          userBookmarks.add(bookmark.article_id);
        });
      }
      
      // ブックマーク読み込み後に全リストを再描画して、しおりアイコンを同期
      if (dashboardData) {
        renderTopNews(dashboardData.topNews);
        renderTrendingNews(dashboardData.trendingNews);
        renderSportsNews(dashboardData.sports);
        renderCuratedNews(curatedNewsItems);
      }
      
      // もしブックマークドロワーが開いていればドロワー内のリストも再描画
      if (bookmarkDrawer.classList.contains('active')) {
        renderBookmarkedArticles();
      }
    } catch (err) {
      console.error('ブックマークの取得に失敗しました:', err.message);
    }
  }

  // ブックマークのトグル追加・削除
  async function toggleBookmark(articleId, btnElement) {
    if (!currentUser) {
      showToast('「あとで読む」機能のご利用にはログインが必要です。', 'warning');
      openAuthModal(false);
      return;
    }
    
    const isBookmarked = userBookmarks.has(articleId);
    
    try {
      if (isBookmarked) {
        // ブックマーク削除
        const { error } = await supabaseClient
          .from('user_bookmarks')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('article_id', articleId);
          
        if (error) throw error;
        
        userBookmarks.delete(articleId);
        showToast('「あとで読む」から削除しました。', 'info');
      } else {
        // ブックマーク追加
        const { error } = await supabaseClient
          .from('user_bookmarks')
          .insert({
            user_id: currentUser.id,
            article_id: articleId
          });
          
        if (error) throw error;
        
        userBookmarks.add(articleId);
        showToast('「あとで読む」に登録しました！', 'success');
      }
      
      // 画面のしおりの見た目を更新（トグルアニメーション）
      // 同一IDのしおりボタンが画面に複数あればすべて更新する
      document.querySelectorAll(`button[data-id="${CSS.escape(articleId)}"]`).forEach(btn => {
        const svg = btn.querySelector('svg');
        if (isBookmarked) {
          btn.classList.remove('active');
          svg.setAttribute('fill', 'none');
        } else {
          btn.classList.add('active');
          svg.setAttribute('fill', 'currentColor');
        }
      });
      
      // 左ドロワーが開いている場合は、リストを即時リフレッシュ
      if (bookmarkDrawer.classList.contains('active')) {
        renderBookmarkedArticles();
      }
      
    } catch (err) {
      console.error('Bookmark toggle error:', err.message);
      showToast('エラーが発生しました: ' + err.message, 'error');
    }
  }

  // ブックマークドロワー内のリストを描画
  function renderBookmarkedArticles() {
    if (!bookmarkDrawerList) return;
    bookmarkDrawerList.innerHTML = '';
    
    if (userBookmarks.size === 0) {
      bookmarkDrawerList.innerHTML = '<div class="loading-placeholder">「あとで読む」に登録された記事はありません。</div>';
      return;
    }
    
    // 全データからブックマークされている記事を検索・抽出
    const allArticles = [];
    
    if (dashboardData) {
      if (dashboardData.topNews) allArticles.push(...dashboardData.topNews.map(a => ({...a, category: 'トップニュース', emotion: 'approved'})));
      if (dashboardData.trendingNews) allArticles.push(...dashboardData.trendingNews.map(a => ({...a, category: '話題のニュース'})));
      if (dashboardData.sports) {
        Object.keys(dashboardData.sports).forEach(key => {
          allArticles.push(...dashboardData.sports[key].map(a => ({...a, category: `スポーツ (${getSportLabel(key)})`, emotion: 'hot'})));
        });
      }
    }
    
    // キュレーションニュースもマージ
    if (curatedNewsItems) {
      allArticles.push(...curatedNewsItems.map(a => ({
        link: a.link,
        aiTitle: a.title,
        aiSummary: a.summary || '詳細記事を参照してください。',
        sources: a.metadata?.sources || [{ publisher: a.feed_name, title: a.title, url: a.link }],
        sns: { hatebu: a.hatebu, x: a.x_count, threads: a.threads_count },
        category: a.category || 'ニュース',
        emotion: a.emotion || 'approved',
        score: a.score
      })));
    }
    
    // 重複を排除しつつ、ブックマーク済みの記事だけをフィルタ
    const processedUrls = new Set();
    const bookmarkedList = [];
    
    allArticles.forEach(art => {
      const url = art.link || art.sources?.[0]?.url;
      if (url && userBookmarks.has(url) && !processedUrls.has(url)) {
        processedUrls.add(url);
        bookmarkedList.push({
          id: url,
          title: art.aiTitle || art.title,
          summary: art.aiSummary || art.summary,
          sources: art.sources || [{ publisher: art.publisher || '情報源', title: art.title || art.aiTitle, url: url }],
          sns: art.sns,
          emotion: art.emotion,
          category: art.category,
          score: art.score
        });
      }
    });

    // どのソースデータにも詳細が見つからなかった場合のフォールバック
    if (processedUrls.size < userBookmarks.size) {
      userBookmarks.forEach(url => {
        if (!processedUrls.has(url)) {
          processedUrls.add(url);
          bookmarkedList.push({
            id: url,
            title: '保存されたニュース記事',
            summary: '記事リンクから詳細をご参照ください。',
            sources: [{ publisher: 'ニュースソース', title: '詳細記事リンク', url: url }],
            sns: null,
            emotion: 'approved',
            category: '保存済み'
          });
        }
      });
    }

    bookmarkedList.forEach(item => {
      const card = document.createElement('article');
      const isRead = readNewsUrls.has(item.id);
      
      card.className = `news-card fade-in${isRead ? ' is-read' : ''}`;
      
      const publisherName = item.sources[0]?.publisher || '一次ソース';
      const otherSourcesCount = item.sources.length - 1;
      
      // 人気スコアバッジ
      let scoreBadgeHtml = '';
      if (item.score) {
        const scoreNum = Number(item.score);
        const formattedScore = scoreNum.toFixed(2);
        let badgeClass = 'score-level-d';
        if (scoreNum >= 85) badgeClass = 'score-level-s';
        else if (scoreNum >= 70) badgeClass = 'score-level-a';
        else if (scoreNum >= 50) badgeClass = 'score-level-b';
        else if (scoreNum >= 25) badgeClass = 'score-level-c';
        scoreBadgeHtml = `<span class="source-badge score-badge ${badgeClass}">${formattedScore}</span>`;
      }
      
      const categoryBadgeHtml = (item.category && item.category !== 'ニュース' && item.category !== '保存済み') 
        ? `<span class="source-badge category-badge">${item.category}</span>` 
        : '';
        
      card.innerHTML = `
        <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.title}</h4>
        <div class="card-meta">
          <div class="source-comparison">
            ${scoreBadgeHtml}
            ${categoryBadgeHtml}
            <span class="source-badge">${publisherName}</span>
            ${otherSourcesCount > 0 ? `<span class="source-badge">他 ${otherSourcesCount} 社</span>` : ''}
          </div>
          ${addCardActionsHtml(item.id, item.title)}
        </div>
      `;
      
      card.addEventListener('click', () => {
        markAsRead(item.id, card);
        openDrawer({
          category: item.category,
          aiTitle: item.title,
          aiSummary: item.summary,
          sources: item.sources,
          sns: item.sns,
          emotion: item.emotion || 'approved'
        });
      });
      
      bindCardActions(card);
      bookmarkDrawerList.appendChild(card);
    });
  }

  // ブックマークドロワー開閉制御
  function openBookmarkDrawer() {
    renderBookmarkedArticles();
    bookmarkDrawer.classList.add('active');
    bookmarkDrawerOverlay.classList.add('active');
    bookmarkDrawer.setAttribute('aria-hidden', 'false');
    closeDrawer(); // 詳細ドロワーが開いていたら閉じる
  }

  function closeBookmarkDrawer() {
    bookmarkDrawer.classList.remove('active');
    bookmarkDrawerOverlay.classList.remove('active');
    bookmarkDrawer.setAttribute('aria-hidden', 'true');
  }

  headerBookmarkBtn.addEventListener('click', openBookmarkDrawer);
  bookmarkDrawerClose.addEventListener('click', closeBookmarkDrawer);
  bookmarkDrawerOverlay.addEventListener('click', closeBookmarkDrawer);

  // 認証状態のリアルタイム監視
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      authUserEmail.textContent = currentUser.email;
      authUserEmail.style.display = 'inline-block';
      authBtnText.textContent = 'ログアウト';
      headerBookmarkBtn.style.display = 'flex'; // ログイン中に「あとで読む」ボタンを出す
      
      await loadUserBookmarks();
    } else {
      currentUser = null;
      authUserEmail.textContent = '';
      authUserEmail.style.display = 'none';
      authBtnText.textContent = 'ログイン';
      headerBookmarkBtn.style.display = 'none'; // ログアウト時は非表示に
      closeBookmarkDrawer(); // ドロワーが開いていたら閉じる
      userBookmarks.clear();
      
      // 描画更新（しおりアイコンのクリア）
      if (dashboardData) {
        renderTopNews(dashboardData.topNews);
        renderTrendingNews(dashboardData.trendingNews);
        renderSportsNews(dashboardData.sports);
        renderCuratedNews(curatedNewsItems);
      }
    }
  });

  // --- 11. スマートフォン対応（モバイルナビゲーション） ---
  
  // スマホ表示時のアクティブカラム更新
  function updateMobileActiveColumn(target) {
    if (!colCurated || !colTopNews || !colTrendingSports) return;
    
    // すべてのカラムからactive-mobileクラスを削除
    colCurated.classList.remove('active-mobile');
    colTopNews.classList.remove('active-mobile');
    colTrendingSports.classList.remove('active-mobile');
    
    // ターゲットに対応するカラムを表示
    if (target === 'curated') {
      colCurated.classList.add('active-mobile');
    } else if (target === 'top') {
      colTopNews.classList.add('active-mobile');
    } else if (target === 'trending') {
      colTrendingSports.classList.add('active-mobile');
    }
  }

  // ナビゲーションボタンのイベントリスナー
  mobileNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // ボタンのアクティブクラス切り替え
      mobileNavButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const target = btn.dataset.target;
      updateMobileActiveColumn(target);
    });
  });

  // リサイズ・初期表示時の表示調整
  function handleResizeAndOrientation() {
    if (!colCurated || !colTopNews || !colTrendingSports) return;
    const isMobile = window.innerWidth <= 768;
    
    // ダイジェストバナーのボタンテキスト切り替え
    const activeBadge = document.getElementById('ai-digest-badge');
    const openBtn = document.getElementById('ai-digest-open-btn');
    if (activeBadge && openBtn) {
      const badgeText = activeBadge.textContent;
      if (isMobile) {
        openBtn.textContent = `${badgeText}を読む`;
      } else {
        openBtn.textContent = 'ダイジェストを読む';
      }
    }
    
    if (isMobile) {
      // モバイル時は、現在アクティブなタブに対応するカラムを表示
      const activeBtn = document.querySelector('.mobile-nav-btn.active');
      if (activeBtn) {
        updateMobileActiveColumn(activeBtn.dataset.target);
      } else {
        // デフォルトは curated
        updateMobileActiveColumn('curated');
      }
    } else {
      // PCサイズ時は、モバイル用の表示制限クラスをすべて消去
      colCurated.classList.remove('active-mobile');
      colTopNews.classList.remove('active-mobile');
      colTrendingSports.classList.remove('active-mobile');
    }
  }

  window.addEventListener('resize', handleResizeAndOrientation);
  // 初期ロード時にも実行
  handleResizeAndOrientation();

  // --- 9. 初期読み込み ＆ ポーリング (30秒) ---
  loadData();
  loadAIDigest();
  initWeather();
  setInterval(loadData, 30000);
  setInterval(loadAIDigest, 5 * 60 * 1000);
});

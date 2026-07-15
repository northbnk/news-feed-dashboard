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
  let currentViewMode = 'dashboard';
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
  
  // RSSフィード追加フォームの要素
  const toggleAddSourceBtn = document.getElementById('toggle-add-source-btn');
  const addSourceFormContainer = document.getElementById('add-source-form-container');
  const newFeedNameInput = document.getElementById('new-feed-name');
  const newFeedUrlInput = document.getElementById('new-feed-url');
  const newFeedCategoryInput = document.getElementById('new-feed-category');
  const newFeedWeightInput = document.getElementById('new-feed-weight');
  const btnTestCrawler = document.getElementById('btn-test-crawler');
  const btnSubmitFeed = document.getElementById('btn-submit-feed');
  const crawlerPreviewContainer = document.getElementById('crawler-preview-container');
  const crawlerPreviewStatus = document.getElementById('crawler-preview-status');
  const crawlerPreviewTitle = document.getElementById('crawler-preview-title');
  const crawlerPreviewText = document.getElementById('crawler-preview-text');
  const addSourceMessage = document.getElementById('add-source-message');

  // フィードステータスモーダルの各要素
  const feedStatusModal = document.getElementById('feed-status-modal');
  const feedStatusModalOverlay = document.getElementById('feed-status-modal-overlay');
  const feedStatusModalCloseBtn = document.getElementById('feed-status-modal-close-btn');
  const feedStatusRefreshBtn = document.getElementById('feed-status-refresh-btn');
  const feedStatusTableBody = document.getElementById('feed-status-table-body');
  const headerLogoContainer = document.querySelector('.header-logo-container');
  const dashboardMain = document.querySelector('.dashboard-main');
  const viewModeToggle = document.getElementById('view-mode-toggle');
  const viewModeToggleText = document.getElementById('view-mode-toggle-text');
  const timelineViewContainer = document.getElementById('timeline-view-container');
  const timelineEventsList = document.getElementById('timeline-events-list');
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
  const bookmarkOpenAllBtn = document.getElementById('bookmark-open-all-btn');
  const bookmarkGenerateDigestBtn = document.getElementById('bookmark-generate-digest-btn');
  const generatedDigestsList = document.getElementById('generated-digests-list');

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
    if (!clockElement) return;
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
  if (clockElement) {
    updateClock();
    setInterval(updateClock, 1000);
  }

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
      if (lastSyncElement) {
        lastSyncElement.textContent = `同期: ${String(syncDate.getHours()).padStart(2, '0')}:${String(syncDate.getMinutes()).padStart(2, '0')}:${String(syncDate.getSeconds()).padStart(2, '0')}`;
      }
      
      // 描画実行 (テロップ系のみ)
      renderHeadline(data.headline);
      renderTicker(data);

    } catch (err) {
      console.error('Data load error:', err.message);
    }
  }

  // A. ヘッドライン描画
  function renderHeadline(headline) {
    if (!headline) {
      headlineBar.style.display = 'none';
      return;
    }
    
    // 一定時間（2時間）経過した速報は非表示にする
    const pubTime = headline.pubDate ? new Date(headline.pubDate).getTime() : 0;
    const hoursElapsed = (Date.now() - pubTime) / (3600 * 1000);
    
    if (hoursElapsed > 2) {
      console.log(`[Headline] 投稿日時より2時間以上経過しているため非表示にします。(${hoursElapsed.toFixed(1)}時間経過)`);
      headlineBar.style.display = 'none';
      return;
    }

    headlineBar.style.display = 'flex';
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
      localStorage.setItem('read_headline', headline.title);
      headlineBar.classList.remove('unread');
      headlineBar.classList.add('read');
      
      const sourcesMd = headline.sources ? headline.sources.map(src => `* [${src.publisher}](${src.url})`).join('\n') : '';
      renderGeneratedDigestInModal(
        `## ${headline.title}\n\n${headline.summary || '要約はありません。'}\n\n**情報元（ソース）**:\n${sourcesMd || 'なし'}`,
        '速報'
      );
    };

    headlineBar.onclick = handleHeadlineClick;
    if (headlineDetailBtn) {
      headlineDetailBtn.onclick = (e) => {
        e.stopPropagation(); // 親要素(headlineBar)のクリックイベント重複発火を防止
        handleHeadlineClick();
      };
    }
  }

  // B. トップニュース描画
  // ニュースカードの画像を非同期で取得して適用する関数
  function applyCardCoverImage(card, defaultUrl, initialImage) {
    if (!card) return;
    
    const imgWrapper = card.querySelector('.card-cover-image-wrapper');
    if (!imgWrapper) return;

    const img = imgWrapper.querySelector('.card-cover-image');

    // すでに有効な画像URLがある場合はそれを即時適用
    if (initialImage && initialImage.startsWith('http')) {
      if (img) {
        img.src = initialImage;
        img.style.display = 'block';
        const skeleton = imgWrapper.querySelector('.image-skeleton-loader');
        if (skeleton) skeleton.style.display = 'none';
      }
      return;
    }

    // 画像がnullの場合は非同期でバックエンドから OGP 画像を取得
    fetch('/api/scrape-image?url=' + encodeURIComponent(defaultUrl))
      .then(res => res.json())
      .then(data => {
        if (data.success && data.image) {
          if (img) {
            img.src = data.image;
            img.style.display = 'block';
            const skeleton = imgWrapper.querySelector('.image-skeleton-loader');
            if (skeleton) skeleton.style.display = 'none';
          }
        } else {
          // 取得失敗時は枠ごと消去してテキストを広げる
          imgWrapper.style.display = 'none';
          card.classList.remove('has-image');
        }
      })
      .catch(() => {
        imgWrapper.style.display = 'none';
        card.classList.remove('has-image');
      });
  }

  // ニュースカードの画像を非同期で取得して適用する関数
  function applyCardCoverImage(card, defaultUrl, initialImage) {
    if (!card) return;
    
    const imgWrapper = card.querySelector('.card-cover-image-wrapper');
    if (!imgWrapper) return;

    const img = imgWrapper.querySelector('.card-cover-image');

    // すでに有効な画像URLがある場合はそれを即時適用
    if (initialImage && initialImage.startsWith('http')) {
      if (img) {
        img.src = initialImage;
        img.style.display = 'block';
        const skeleton = imgWrapper.querySelector('.image-skeleton-loader');
        if (skeleton) skeleton.style.display = 'none';
      }
      return;
    }

    // 画像がnullの場合は非同期でバックエンドから OGP 画像を取得
    fetch('/api/scrape-image?url=' + encodeURIComponent(defaultUrl))
      .then(res => res.json())
      .then(data => {
        if (data.success && data.image) {
          if (img) {
            img.src = data.image;
            img.style.display = 'block';
            const skeleton = imgWrapper.querySelector('.image-skeleton-loader');
            if (skeleton) skeleton.style.display = 'none';
          }
        } else {
          // 取得失敗時は枠ごと消去してテキストを広げる
          imgWrapper.style.display = 'none';
          card.classList.remove('has-image');
        }
      })
      .catch(() => {
        imgWrapper.style.display = 'none';
        card.classList.remove('has-image');
      });
  }

  function renderTopNews(topNews) {
    if (!topNewsList) return;
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
      
      card.className = `news-card fade-in${isRead ? ' is-read' : ''} has-image`;
      
      card.innerHTML = `
        <div class="card-cover-image-wrapper">
          <div class="image-skeleton-loader" style="width:100%; height:100%; background:linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%); background-size: 200% 100%; animation: skeletonShimmer 1.5s infinite;"></div>
          <img src="" alt="${item.aiTitle}" class="card-cover-image" loading="lazy" style="display:none;" onerror="this.parentNode.style.display='none'; this.closest('.news-card').classList.remove('has-image');">
        </div>
        <div class="card-body-content">
          <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.aiTitle}</h4>
          <p class="card-summary-preview">${item.aiSummary || '要約情報はありません。'}</p>
          <div class="card-meta">
            <div class="source-comparison">
              <span class="source-badge">${item.sources[0]?.publisher || '一次ソース'}</span>
              ${item.sources.length > 1 ? `<span class="source-badge">他 ${item.sources.length - 1} 社</span>` : ''}
            </div>
            ${addCardActionsHtml(defaultUrl, item.aiTitle)}
          </div>
        </div>
      `;
      
      // 画像の非同期ロード＆フォールバックの実行
      applyCardCoverImage(card, defaultUrl, item.image);
      
      // アイテムデータをDOMに紐付ける
      card.__itemData = item;
      card.addEventListener('click', (e) => {
        syncFocusOnCardClick(card);
        if (card.classList.contains('expanded') && (e.target.tagName === 'H4' || e.target.closest('h4'))) {
          e.stopPropagation();
          window.open(defaultUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        markAsRead(defaultUrl, card);
        toggleCardDetails(card, {
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
      
      const itemImage = item.image || (item.metadata?.image) || null;
      card.className = `news-card fade-in${isRead ? ' is-read' : ''}${itemImage ? ' has-image' : ''}`;
      
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

      const imageHtml = itemImage ? `
        <div class="card-cover-image-wrapper">
          <img src="${itemImage}" alt="${item.title}" class="card-cover-image" loading="lazy" onerror="this.parentNode.style.display='none'">
        </div>
      ` : '';

      card.innerHTML = `
        ${imageHtml}
        <div class="card-body-content">
          <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.title}</h4>
          <p class="card-summary-preview">${item.summary || '詳細記事を参照してください。'}</p>
          <div class="card-meta">
            <div class="source-comparison">
              ${scoreBadgeHtml}
              ${categoryBadgeHtml}
              <span class="source-badge">${publisherName}</span>
              ${otherSourcesCount > 0 ? `<span class="source-badge">他 ${otherSourcesCount} 社</span>` : ''}
            </div>
            ${addCardActionsHtml(defaultUrl, item.title)}
          </div>
        </div>
      `;
      
      // アイテムデータをDOMに紐付ける
      card.__itemData = item;
      card.addEventListener('click', (e) => {
        syncFocusOnCardClick(card);
        if (card.classList.contains('expanded') && (e.target.tagName === 'H4' || e.target.closest('h4'))) {
          e.stopPropagation();
          window.open(defaultUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        markAsRead(defaultUrl, card);
        const emotion = item.emotion || 'approved';
        
        toggleCardDetails(card, {
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
    if (!trendingNewsList) return;
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
      
      const itemImage = item.image || null;
      card.className = `news-card fade-in${isRead ? ' is-read' : ''}${itemImage ? ' has-image' : ''}`;
      
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
      
      const imageHtml = itemImage ? `
        <div class="card-cover-image-wrapper">
          <img src="${itemImage}" alt="${item.aiTitle}" class="card-cover-image" loading="lazy" onerror="this.parentNode.style.display='none'">
        </div>
      ` : '';

      card.innerHTML = `
        ${imageHtml}
        <div class="card-body-content">
          <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.aiTitle}</h4>
          <p class="card-summary-preview">${item.aiSummary || '要約情報はありません。'}</p>
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

      // アイテムデータをDOMに紐付ける
      card.__itemData = item;
      card.addEventListener('click', (e) => {
        syncFocusOnCardClick(card);
        if (card.classList.contains('expanded') && (e.target.tagName === 'H4' || e.target.closest('h4'))) {
          e.stopPropagation();
          window.open(defaultUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        markAsRead(defaultUrl, card);
        toggleCardDetails(card, {
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
    if (!sportsNewsList) return;
    sportsNewsList.innerHTML = '';
    if (!sportsData) return;
    


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
      
      card.className = `news-card fade-in${isRead ? ' is-read' : ''} has-image`;
      
      card.innerHTML = `
        <div class="card-cover-image-wrapper">
          <div class="image-skeleton-loader" style="width:100%; height:100%; background:linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%); background-size: 200% 100%; animation: skeletonShimmer 1.5s infinite;"></div>
          <img src="" alt="${item.aiTitle}" class="card-cover-image" loading="lazy" style="display:none;" onerror="this.parentNode.style.display='none'; this.closest('.news-card').classList.remove('has-image');">
        </div>
        <div class="card-body-content">
          <h4>${!isRead ? '<span class="unread-dot"></span>' : ''}${item.aiTitle}</h4>
          <p class="card-summary-preview">${item.aiSummary || '要約情報はありません。'}</p>
          <div class="card-meta">
            <div class="source-comparison">
              <span class="source-badge">${item.sources[0]?.publisher || 'スポーツ紙'}</span>
              ${item.sources.length > 1 ? `<span class="source-badge">他 ${item.sources.length - 1} 社</span>` : ''}
            </div>
            ${addCardActionsHtml(defaultUrl, item.aiTitle)}
          </div>
        </div>
      `;
      
      // 画像の非同期ロード＆フォールバックの実行
      applyCardCoverImage(card, defaultUrl, item.image);
      
      // アイテムデータをDOMに紐付ける
      card.__itemData = item;
      card.addEventListener('click', (e) => {
        syncFocusOnCardClick(card);
        if (card.classList.contains('expanded') && (e.target.tagName === 'H4' || e.target.closest('h4'))) {
          e.stopPropagation();
          window.open(defaultUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        markAsRead(defaultUrl, card);
        toggleCardDetails(card, {
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
    // ニュースデータのカルーセル構築は廃止されました
  }

  // --- 4. 詳細表示アコーディオンの制御（カード直下展開） ---
  function toggleCardDetails(cardElement, item) {
    closeBookmarkDrawer(); // 左ドロワーが開いていたら閉じる

    // すでに開いている他のカードがあれば閉じる (排他制御)
    const currentlyActive = document.querySelector('.news-card.expanded, .card-item.expanded');
    const isSame = (currentlyActive === cardElement);

    if (currentlyActive) {
      currentlyActive.classList.remove('expanded');
      const expandedPart = currentlyActive.querySelector('.card-details-expanded');
      if (expandedPart) {
        expandedPart.style.maxHeight = '0';
        expandedPart.style.opacity = '0';
        setTimeout(() => expandedPart.remove(), 350);
      }
    }

    // 同じカードをクリックして閉じるだけの場合はここで終了
    if (isSame) return;

    // カードを拡張状態にする
    cardElement.classList.add('expanded');

    // 詳細領域の作成
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'card-details-expanded';
    
    // 詳細領域内をクリックした時はカード自体のトグルが走らないようにする
    detailsDiv.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // 感情バッジHTML
    let emotionHtml = '';
    if (item.emotion && item.sns) {
      const emotionNames = { hot: '大注目', surprised: '驚き', funny: '面白い', sad: '懸念', approved: '賛同' };
      emotionHtml = `<span class="emotion-badge ${item.emotion}-badge">${emotionNames[item.emotion] || '話題'}</span>`;
    }

    // SNS統計
    let snsHtml = '';
    if (item.sns) {
      snsHtml = `
        <div class="details-sns-row">
          <span class="sns-stat">𝕏 ${formatCount(item.sns.x)}</span>
          <span class="sns-stat">🔖 ${formatCount(item.sns.hatebu)}</span>
        </div>
      `;
    }

    // ソースリンク
    let sourcesHtml = '';
    if (item.sources && item.sources.length > 0) {
      sourcesHtml = item.sources.map(src => `
        <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="source-link-tag" title="${src.title}">
          <span>${src.publisher}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      `).join('');
    } else {
      sourcesHtml = '<span class="loading-placeholder">詳細ソース記事がありません</span>';
    }

    const defaultUrl = item.sources?.[0]?.url || '#';
    
    // ChatGPT: WEB検索付き深掘りリンク (qパラメータ & hints=search)
    const chatgptPrompt = `WEB検索を利用してこの記事の深掘りをして：\n${defaultUrl}`;
    const chatgptUrl = `https://chatgpt.com/?q=${encodeURIComponent(chatgptPrompt)}&hints=search`;
    
    // Perplexity: 深掘り検索リンク (qパラメータ)
    const perplexityPrompt = `この記事の深掘りをして：\n${defaultUrl}`;
    const perplexityUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(perplexityPrompt)}`;

    const deepDiveBtnsHtml = defaultUrl !== '#' ? `
      <a href="${chatgptUrl}" target="_blank" rel="noopener noreferrer" class="chatgpt-deep-dive-btn" title="ChatGPTでWeb検索してこの記事を深掘り">
        <span>💬 ChatGPTで深掘り</span>
      </a>
      <a href="${perplexityUrl}" target="_blank" rel="noopener noreferrer" class="perplexity-deep-dive-btn" title="Perplexityでこの記事を深掘り・検索">
        <span>🔍 Perplexityで深掘り</span>
      </a>
    ` : '';

    detailsDiv.innerHTML = `
      <div class="details-content-inner">
        <div class="details-meta-row">
          <div class="details-sources">
            ${sourcesHtml}
          </div>
          <div class="details-right-badges">
            ${snsHtml}
            ${emotionHtml}
            ${deepDiveBtnsHtml}
          </div>
        </div>
      </div>
    `;

    cardElement.appendChild(detailsDiv);

    // アニメーション用に高さを動的に適用
    requestAnimationFrame(() => {
      detailsDiv.style.maxHeight = (detailsDiv.scrollHeight + 40) + 'px';
      detailsDiv.style.opacity = '1';
      // アニメーション完了後に maxHeight を 'none' に解除して見切れを完全に防止
      setTimeout(() => {
        if (cardElement.classList.contains('expanded')) {
          detailsDiv.style.maxHeight = 'none';
        }
      }, 350);
    });
  }

  // --- 4. 詳細表示ドロワーの開閉 ＆ データ注入 ---
  function openDrawer(item) {
    // 後方互換用：サイドドロワーの代わりにモーダル表示へフォールバック
    const sourcesMd = item.sources ? item.sources.map(src => `* [${src.publisher}](${src.url})`).join('\n') : '';
    renderGeneratedDigestInModal(
      `## ${item.aiTitle}\n\n${item.aiSummary || '要約はありません。'}\n\n**情報元（ソース）**:\n${sourcesMd || 'なし'}`,
      item.category
    );
  }

  function closeDrawer() {
    detailDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    detailDrawer.setAttribute('aria-hidden', 'true');
  }

  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  // --- 5. スポーツタブの切り替え ---
  if (sportsTabs) {
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
  }

  // --- 5-2. トップニュースタブの切り替え ---
  if (topNewsTabs) {
    topNewsTabs.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab-btn')) return;
      
      topNewsTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      
      currentTopNewsTab = e.target.dataset.tab;
      if (dashboardData) {
        renderTopNews(dashboardData.topNews);
      }
    });
  }

  // --- 5-3. 話題のニュースタブの切り替え ---
  if (trendingNewsTabs) {
    trendingNewsTabs.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab-btn')) return;
      
      trendingNewsTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      
      currentTrendingNewsTab = e.target.dataset.tab;
      if (dashboardData) {
        renderTrendingNews(dashboardData.trendingNews);
      }
    });
  }

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

  // カード内アクションボタン（ブックマーク）のHTML
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
      </div>
    `;
  }

  function bindCardActions(cardElement) {
    const bookmarkBtn = cardElement.querySelector('.bookmark-btn');
    
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const articleId = bookmarkBtn.dataset.id;
        toggleBookmark(articleId, bookmarkBtn);
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
    if (!weatherElement) return;
    
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
    
    if (!cityElement || !infoElement || !forecastList) return;
    
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

  // --- 8-2. 天気・地名ホバーポップアップ制御 ---
  const weatherCityWrapper = document.getElementById('weather-city-wrapper');
  const weatherInfoWrapper = document.getElementById('weather-info-wrapper');
  const cityNewsPopup = document.getElementById('city-news-popup');
  const weatherForecastPopup = document.getElementById('weather-forecast-popup');
  const cityNewsList = document.getElementById('city-news-list');

  if (weatherCityWrapper) {
    weatherCityWrapper.addEventListener('mouseenter', () => {
      buildCityNews();
      if (cityNewsPopup) cityNewsPopup.style.display = 'block';
    });

    weatherCityWrapper.addEventListener('mouseleave', () => {
      if (cityNewsPopup) cityNewsPopup.style.display = 'none';
    });
  }

  if (weatherInfoWrapper) {
    weatherInfoWrapper.addEventListener('mouseenter', () => {
      if (weatherForecastPopup) weatherForecastPopup.style.display = 'flex';
    });

    weatherInfoWrapper.addEventListener('mouseleave', () => {
      if (weatherForecastPopup) weatherForecastPopup.style.display = 'none';
    });
  }

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
        const sourcesMd = n.sources ? n.sources.map(src => `* [${src.publisher}](${src.url})`).join('\n') : '';
        renderGeneratedDigestInModal(
          `## ${n.aiTitle}\n\n${n.aiSummary || '要約はありません。'}\n\n**情報元（ソース）**:\n${sourcesMd || 'なし'}`,
          '地方ニュース'
        );
      });
      cityNewsList.appendChild(item);
    });
  }

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
      }
      
      // 画面のしおりの見た目を更新（トグルアニメーション）
      // 同一IDのしおりボタンが画面に複数あればすべて更新する
      document.querySelectorAll(`button[data-id="${articleId}"]`).forEach(btn => {
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
        window.open(item.id, '_blank', 'noopener,noreferrer');
        closeBookmarkDrawer();
      });
      
      bindCardActions(card);
      bookmarkDrawerList.appendChild(card);
    });
  }

  // 作成済みまとめ記事の描画
  function renderGeneratedSummaries() {
    if (!generatedDigestsList) return;
    generatedDigestsList.innerHTML = '';

    const summaries = JSON.parse(localStorage.getItem('generatedSummaries') || '[]');
    if (summaries.length === 0) {
      generatedDigestsList.innerHTML = '<div class="loading-placeholder">作成済みのまとめはありません。</div>';
      return;
    }

    summaries.forEach(item => {
      const card = document.createElement('div');
      card.className = 'digest-history-card';
      const dateStr = new Date(item.generatedAt).toLocaleString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      card.innerHTML = `
        <h4>AIまとめ記事 (${dateStr})</h4>
        <div class="meta">
          <span class="article-count">${item.urls.length} 件の記事から作成</span>
        </div>
      `;

      card.addEventListener('click', () => {
        renderGeneratedDigestInModal(item.text, dateStr);
      });

      generatedDigestsList.appendChild(card);
    });
  }

  // まとめ記事をモーダルにレンダリングして表示
  function renderGeneratedDigestInModal(markdownText, dateStr) {
    const modalTitle = aiDigestModal.querySelector('.ai-digest-modal-header h3');
    if (modalTitle) {
      modalTitle.textContent = `AIまとめ記事 (${dateStr || '生成完了'})`;
    }

    const html = parseMarkdownToHtml(markdownText);
    aiDigestModalBody.innerHTML = html;
    
    aiDigestModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // マークダウンの簡易変換
  function parseMarkdownToHtml(md) {
    if (!md) return '';
    let html = md.trim();

    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = html.split('\n');
    let parsedHtml = '';
    let inList = false;
    let inTable = false;
    let tableHeaders = [];

    lines.forEach(line => {
      const trimmed = line.trim();

      if (trimmed.startsWith('### ')) {
        if (inList) { parsedHtml += '</ul>'; inList = false; }
        if (inTable) { parsedHtml += '</tbody></table>'; inTable = false; }
        parsedHtml += `<h4>${trimmed.substring(4)}</h4>`;
        return;
      }
      if (trimmed.startsWith('## ')) {
        if (inList) { parsedHtml += '</ul>'; inList = false; }
        if (inTable) { parsedHtml += '</tbody></table>'; inTable = false; }
        parsedHtml += `<h3>${trimmed.substring(3)}</h3>`;
        return;
      }

      if (trimmed.startsWith('|')) {
        if (inList) { parsedHtml += '</ul>'; inList = false; }
        const cells = trimmed.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);
        
        if (trimmed.includes('---')) {
          return;
        }

        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
          parsedHtml += '<table class="ai-digest-table"><thead><tr>';
          cells.forEach(c => {
            parsedHtml += `<th>${parseInlineMarkdownText(c)}</th>`;
          });
          parsedHtml += '</tr></thead><tbody>';
        } else {
          parsedHtml += '<tr>';
          cells.forEach(c => {
            parsedHtml += `<td>${parseInlineMarkdownText(c)}</td>`;
          });
          parsedHtml += '</tr>';
        }
        return;
      } else {
        if (inTable) {
          parsedHtml += '</tbody></table>';
          inTable = false;
        }
      }

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        if (!inList) {
          inList = true;
          parsedHtml += '<ul class="ai-digest-list">';
        }
        parsedHtml += `<li>${parseInlineMarkdownText(trimmed.substring(2))}</li>`;
        return;
      } else {
        if (inList) {
          parsedHtml += '</ul>';
          inList = false;
        }
      }

      if (trimmed === '') {
        return;
      }

      parsedHtml += `<p class="digest-paragraph">${parseInlineMarkdownText(trimmed)}</p>`;
    });

    if (inList) parsedHtml += '</ul>';
    if (inTable) parsedHtml += '</tbody></table>';

    return parsedHtml;
  }

  function parseInlineMarkdownText(text) {
    let html = text;
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // 生の URL (https?://) を安全に自動リンク化
    const linkPlaceholderMap = [];
    html = html.replace(/<a\s+[^>]*>.*?<\/a>/gi, (match) => {
      const id = `__LINK_PLACEHOLDER_${linkPlaceholderMap.length}__`;
      linkPlaceholderMap.push({ id, original: match });
      return id;
    });

    const urlPattern = /(https?:\/\/[^\s\)<>"\u3000-\u30FF\u4E00-\u9FFF]+)/gi;
    html = html.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

    linkPlaceholderMap.forEach(item => {
      html = html.replace(item.id, item.original);
    });

    return html;
  }


  // ブックマークドロワー開閉制御
  function openBookmarkDrawer() {
    renderBookmarkedArticles();
    renderGeneratedSummaries();
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

  if (headerBookmarkBtn) headerBookmarkBtn.addEventListener('click', openBookmarkDrawer);
  if (bookmarkDrawerClose) bookmarkDrawerClose.addEventListener('click', closeBookmarkDrawer);
  if (bookmarkDrawerOverlay) bookmarkDrawerOverlay.addEventListener('click', closeBookmarkDrawer);

  // 認証状態のリアルタイム監視
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      authUserEmail.textContent = currentUser.email;
      authUserEmail.style.display = 'inline-block';
      authBtnText.textContent = 'ログアウト';
      if (headerBookmarkBtn) headerBookmarkBtn.style.display = 'flex'; // ログイン中に「あとで読む」ボタンを出す
      
      await loadUserBookmarks();
    } else {
      currentUser = null;
      authUserEmail.textContent = '';
      authUserEmail.style.display = 'none';
      authBtnText.textContent = 'ログイン';
      if (headerBookmarkBtn) headerBookmarkBtn.style.display = 'none'; // ログアウト時は非表示に
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

  // すべて新規タブで開く
  if (bookmarkOpenAllBtn) {
    bookmarkOpenAllBtn.addEventListener('click', () => {
      if (userBookmarks.size === 0) {
        showToast('「あとで読む」に登録された記事がありません。', 'warning');
        return;
      }
      userBookmarks.forEach(url => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    });
  }

  // AIまとめ記事の作成
  if (bookmarkGenerateDigestBtn) {
    bookmarkGenerateDigestBtn.addEventListener('click', async () => {
      if (userBookmarks.size === 0) {
        showToast('まとめ記事の作成対象がありません。記事をしおり登録してください。', 'warning');
        return;
      }

      const urls = Array.from(userBookmarks);
      
      const originalText = bookmarkGenerateDigestBtn.innerHTML;
      bookmarkGenerateDigestBtn.disabled = true;
      bookmarkGenerateDigestBtn.innerHTML = '<span>生成中 (約30秒)...</span>';

      try {
        const response = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'サーバーエラーが発生しました。');
        }

        const data = await response.json();

        // 履歴に保存
        const summaries = JSON.parse(localStorage.getItem('generatedSummaries') || '[]');
        const newDigest = {
          id: Date.now().toString(),
          text: data.markdownContent,
          generatedAt: Date.now(),
          urls: urls
        };
        summaries.unshift(newDigest);
        localStorage.setItem('generatedSummaries', JSON.stringify(summaries));

        // 「記事化したものは後で読むから削除」
        if (currentUser) {
          try {
            await supabaseClient
              .from('user_bookmarks')
              .delete()
              .eq('user_id', currentUser.id)
              .in('article_id', urls);
          } catch (se) {
            console.error('Supabase bookmark cleanup error:', se.message);
          }
        }

        // ローカルしおりリストをクリア
        urls.forEach(url => userBookmarks.delete(url));

        // 画面全体のしおりボタンの見た目をオフ（同期）
        urls.forEach(url => {
          document.querySelectorAll(`button[data-id="${url}"]`).forEach(btn => {
            btn.classList.remove('active');
            const svg = btn.querySelector('svg');
            if (svg) svg.setAttribute('fill', 'none');
          });
        });

        // ドロワーの表示を即時更新
        renderBookmarkedArticles();
        renderGeneratedSummaries();

        // まとめ記事モーダルで開く
        const dateStr = new Date(newDigest.generatedAt).toLocaleString('ja-JP', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        renderGeneratedDigestInModal(data.markdownContent, dateStr);

        showToast('まとめ記事を作成しました！対象記事をしおりから削除しました。', 'success');

      } catch (err) {
        console.error('AI Summary generate error:', err);
        showToast('作成に失敗しました: ' + err.message, 'error');
      } finally {
        bookmarkGenerateDigestBtn.disabled = false;
        bookmarkGenerateDigestBtn.innerHTML = originalText;
      }
    });
  }


  // AIダイジェストモーダルのクローズイベント (初期ロード時に無条件で登録)
  const closeAIDigestModal = () => {
    aiDigestModal.style.display = 'none';
    document.body.style.overflow = ''; // スクロール復帰
  };

  if (aiDigestModalCloseBtn) {
    aiDigestModalCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAIDigestModal();
    });
  }

  if (aiDigestModalOverlay) {
    aiDigestModalOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAIDigestModal();
    });
  }

  // Escapeキーでモーダルを閉じる
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (aiDigestModal.style.display === 'flex' || aiDigestModal.style.display === 'block')) {
      closeAIDigestModal();
    }
  });


  // --- 12. キーボードショートカット操作ロジック ---
  let activeCol = 1;      // 初期カラム: 一般トップニュース (0=キュレーション, 1=一般, 2=話題・スポーツ)
  let activeCardIdx = 0;  // カラム内のアクティブカード

  // カードクリック時にフォーカス状態（アクティブカラム、インデックス）を連動・同期する
  function syncFocusOnCardClick(cardElement) {
    const parentCurated = cardElement.closest('#curated-news-list');
    const parentTop = cardElement.closest('#top-news-list');
    const parentTrending = cardElement.closest('#trending-news-list');
    const parentSports = cardElement.closest('#sports-news-list');

    if (parentCurated) {
      activeCol = 0;
    } else if (parentTop) {
      activeCol = 1;
    } else if (parentTrending || parentSports) {
      activeCol = 2;
    } else {
      return;
    }

    const cards = getCardsInColumn(activeCol);
    const idx = cards.indexOf(cardElement);
    if (idx !== -1) {
      activeCardIdx = idx;
      
      // フォーカス表示だけを更新（アコーディオンのトグルは個別のクリックイベントに任せる）
      document.querySelectorAll('.news-card, .card-item').forEach(el => {
        el.classList.remove('focused-card');
      });
      cardElement.classList.add('focused-card');
    }
  }

  function getCardsInColumn(colIdx) {
    if (colIdx === 0) {
      return Array.from(document.querySelectorAll('#curated-news-list .news-card'));
    } else if (colIdx === 1) {
      return Array.from(document.querySelectorAll('#top-news-list .news-card'));
    } else if (colIdx === 2) {
      const trending = Array.from(document.querySelectorAll('#trending-news-list .news-card'));
      const sports = Array.from(document.querySelectorAll('#sports-news-list .news-card'));
      return [...trending, ...sports];
    }
    return [];
  }

  function updateFocusVisuals() {
    // 全カードからフォーカスクラスを除去
    document.querySelectorAll('.news-card, .card-item').forEach(el => {
      el.classList.remove('focused-card');
    });

    const cards = getCardsInColumn(activeCol);
    if (cards.length === 0) return;

    // インデックス値の境界制御
    if (activeCardIdx >= cards.length) {
      activeCardIdx = cards.length - 1;
    }
    if (activeCardIdx < 0) {
      activeCardIdx = 0;
    }

    const targetCard = cards[activeCardIdx];
    if (targetCard) {
      targetCard.classList.add('focused-card');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // 他のカードが展開中の場合は、移動先のカードも自動展開し、古いカードを閉じる
      const currentlyActive = document.querySelector('.news-card.expanded, .card-item.expanded');
      if (currentlyActive && currentlyActive !== targetCard) {
        targetCard.click();
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    // 入力欄や認証モーダルフォーカス時はショートカットを無効化
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    const cards = getCardsInColumn(activeCol);

    switch (e.key) {
      case 'j':
      case 'J':
      case 'ArrowUp': // j: 上
        e.preventDefault();
        if (cards.length > 0 && activeCardIdx > 0) {
          activeCardIdx--;
          updateFocusVisuals();
        }
        break;

      case 'l':
      case 'L':
      case 'ArrowDown': // l: 下
        e.preventDefault();
        if (cards.length > 0 && activeCardIdx < cards.length - 1) {
          activeCardIdx++;
          updateFocusVisuals();
        }
        break;

      case 'i':
      case 'I':
      case 'ArrowLeft': // i: 左
        e.preventDefault();
        if (activeCol > 0) {
          activeCol--;
          const targetCards = getCardsInColumn(activeCol);
          activeCardIdx = Math.min(activeCardIdx, Math.max(0, targetCards.length - 1));
          updateFocusVisuals();
        }
        break;

      case 'k':
      case 'K':
      case 'ArrowRight': // k: 右
        e.preventDefault();
        if (activeCol < 2) {
          activeCol++;
          const targetCards = getCardsInColumn(activeCol);
          activeCardIdx = Math.min(activeCardIdx, Math.max(0, targetCards.length - 1));
          updateFocusVisuals();
        }
        break;

      case 'Enter':
      case 'o':
      case ' ':
        if (cards.length > 0) {
          const targetCard = cards[activeCardIdx];
          if (targetCard) {
            e.preventDefault();
            // タイトルではなくカードのトグルとして発火
            targetCard.click();
            
            // トグル後のフォーカスビジュアルの維持
            setTimeout(updateFocusVisuals, 100);
          }
        }
        break;

      case 'v':
        if (cards.length > 0) {
          const targetCard = cards[activeCardIdx];
          if (targetCard) {
            e.preventDefault();
            // カード内にあるしおり等アクションボタンから元記事URLを取得
            const actionBtn = targetCard.querySelector('.btn-action[data-id]');
            if (actionBtn) {
              const url = actionBtn.getAttribute('data-id');
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          }
        }
        break;
    }
  });

  // データロード完了時のフォーカス同期
  const originalLoadData = loadData;
  loadData = async function() {
    await originalLoadData();
    setTimeout(updateFocusVisuals, 1500); // 描画遅延を考慮
  };


  // --- 13. フィードステータスモーダルの制御 ＆ レンダリング ---
  const categoryNames = { general: '一般/ビジネス', tech: 'テック/IT', trending: '話題/ガジェット', sports: 'スポーツ' };
  let statusPollInterval = null;

  async function loadFeedStatus() {
    try {
      const res = await fetch('/api/feed-status');
      const data = await res.json();
      if (data.success) {
        renderFeedStatus(data.statuses);
        
        // 収集中の場合は収集ボタンを「収集中...」にして無効化
        if (data.isCollecting) {
          feedStatusRefreshBtn.disabled = true;
          feedStatusRefreshBtn.textContent = 'データ収集中...';
          
          // ポーリングがまだなら開始
          if (!statusPollInterval) {
            statusPollInterval = setInterval(loadFeedStatus, 3000);
          }
        } else {
          feedStatusRefreshBtn.disabled = false;
          feedStatusRefreshBtn.textContent = '今すぐ収集';
          if (statusPollInterval) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch feed status:', err.message);
    }
  }

  // タイムラインデータのロードと描画
  async function loadTimeline() {
    if (!timelineEventsList) return;
    timelineEventsList.innerHTML = '<div class="loading-placeholder">タイムラインデータを取得中...</div>';

    try {
      const response = await fetch('/api/timeline?t=' + Date.now());
      if (!response.ok) throw new Error('タイムラインデータの取得に失敗しました');

      const data = await response.json();
      if (!data.success || !data.timeline || data.timeline.length === 0) {
        timelineEventsList.innerHTML = '<div class="loading-placeholder">現在、タイムライン用の重大ニュースはありません。定時収集をお待ちください。</div>';
        return;
      }

      renderTimeline(data.timeline);
    } catch (err) {
      console.error('Timeline load error:', err.message);
      timelineEventsList.innerHTML = `<div class="loading-placeholder" style="color:var(--text-error);">データのロードに失敗しました: ${err.message}</div>`;
    }
  }

  // タイムラインのレンダリング
  function renderTimeline(timelineItems) {
    timelineEventsList.innerHTML = '';
    
    // 1. タイムライン全体を古い順（昇順）に並び替える
    timelineItems.sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime());
    
    // 日付ごとにグループ化（"7月13日 (月)" 等の文字列をキーにする）
    const groups = {};
    
    timelineItems.forEach(item => {
      const pubDate = new Date(item.pubDate);
      if (isNaN(pubDate.getTime())) return;
      
      const options = { month: 'short', day: 'numeric', weekday: 'short' };
      const dateKey = pubDate.toLocaleDateString('ja-JP', options);
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });

    // 2. 各日付グループを古い順にソートしてレンダリング
    const sortedDateKeys = Object.keys(groups).sort((a, b) => {
      const parseDateStr = (str) => {
        const m = str.match(/(\d+)月\s*(\d+)日/);
        if (!m) return 0;
        return new Date(2026, parseInt(m[1], 10) - 1, parseInt(m[2], 10)).getTime();
      };
      return parseDateStr(a) - parseDateStr(b);
    });

    sortedDateKeys.forEach(dateKey => {
      // 日付セクション
      const dateHeader = document.createElement('div');
      dateHeader.className = 'timeline-date-header';
      dateHeader.innerHTML = `<span>${dateKey}</span>`;
      timelineEventsList.appendChild(dateHeader);

      // その日の出来事リスト
      groups[dateKey].forEach(item => {
        const itemDate = new Date(item.pubDate);
        const timeStr = String(itemDate.getHours()).padStart(2, '0') + ':' + String(itemDate.getMinutes()).padStart(2, '0');
        
        const card = document.createElement('article');
        card.className = 'timeline-card fade-in';
        
        const sources = item.sources || [{ publisher: item.publisher, title: item.title, url: item.url, pubDate: item.pubDate }];
        
        // 各社報道（sources）を時系列（古い順）にソート
        const sortedSources = [...sources].sort((sa, sb) => {
          const da = sa.pubDate ? new Date(sa.pubDate).getTime() : 0;
          const db = sb.pubDate ? new Date(sb.pubDate).getTime() : 0;
          return da - db;
        });

        // 子要素（個別記事の箇条書きツリー）を組み立てる
        const sourcesListHtml = sortedSources.map(src => {
          const srcDate = src.pubDate ? new Date(src.pubDate) : itemDate;
          
          // mm/dd フォーマット
          const mm = String(srcDate.getMonth() + 1).padStart(2, '0');
          const dd = String(srcDate.getDate()).padStart(2, '0');
          const dateStr = `${mm}/${dd}`;
          
          // 未読既読チェック
          const isSrcRead = readNewsUrls.has(src.url);
          
          return `
            <li>
              <span class="source-date-label">${dateStr}</span>
              <span class="source-publisher-label">[${src.publisher}]</span>
              <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="source-article-link ${isSrcRead ? 'is-read' : ''}" data-url="${src.url}">
                ${!isSrcRead ? '<span class="unread-dot" style="display:inline-block; width:6px; height:6px; background:#8b5cf6; border-radius:50%; margin-right:6px; vertical-align:middle;"></span>' : ''}${src.title}
              </a>
            </li>
          `;
        }).join('');

        card.innerHTML = `
          <!-- タイムライン左側のインジケータ（ドットと時刻） -->
          <div class="timeline-badge-column">
            <span class="timeline-time-label">${timeStr}</span>
            <div class="timeline-dot-outer">
              <div class="timeline-dot-pulse"></div>
              <div class="timeline-dot"></div>
            </div>
          </div>
          
          <!-- カードコンテンツ (カード枠なしのシンプルなテキストツリー) -->
          <div class="timeline-card-content">
            <h4>${item.title}</h4>
            
            <!-- 出来事を構成する報道元ツリー -->
            <ul class="timeline-sources-list">
              ${sourcesListHtml}
            </ul>
          </div>
        `;

        // リンククリック時に既読処理を行うためのバインド
        const links = card.querySelectorAll('.source-article-link');
        links.forEach(link => {
          link.addEventListener('click', (e) => {
            const url = link.getAttribute('data-url');
            markAsRead(url, card);
            
            const dot = link.querySelector('.unread-dot');
            if (dot) dot.remove();
            link.classList.add('is-read');
          });
        });

        timelineEventsList.appendChild(card);
      });
    });
  }

    function renderFeedStatus(statuses) {
    if (!feedStatusTableBody) return;
    feedStatusTableBody.innerHTML = '';

    const feedNames = Object.keys(statuses);
    if (feedNames.length === 0) {
      feedStatusTableBody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; opacity: 0.5;">まだ収集データがありません。ニュースデータの初回取得をお待ちください。</td></tr>';
      return;
    }

    const sortedNames = feedNames.sort((a, b) => {
      const catA = statuses[a].category;
      const catB = statuses[b].category;
      if (catA !== catB) return catA.localeCompare(catB);
      return a.localeCompare(b);
    });

    sortedNames.forEach(name => {
      const feed = statuses[name];
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid var(--border-color)';
      
      // 状態バッジ
      let statusBadge = '';
      if (feed.status === 'success') {
        statusBadge = '<span class="status-indicator success">正常</span>';
      } else if (feed.status === 'error') {
        statusBadge = '<span class="status-indicator error" title="クリックで詳細表示" style="cursor:pointer;">エラー</span>';
      } else if (feed.status === 'fetching') {
        statusBadge = '<span class="status-indicator fetching">取得中</span>';
      } else {
        statusBadge = '<span class="status-indicator fetching">待機中</span>';
      }

      // 時間フォーマット
      const timeStr = feed.lastFetched ? new Date(feed.lastFetched).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '未取得';
      
      // エラー内容
      const errorMsg = feed.error ? `<span style="color:var(--text-muted); font-size:11px; word-break:break-all;">${feed.error}</span>` : '<span style="color:#10b981; font-size:11px;">エラーなし</span>';

      // 重み（優先度）のバッジ化
      let weightBadgeHtml = '';
      const w = Number(feed.weight);
      if (w >= 10) {
        weightBadgeHtml = '<span class="status-indicator error" style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); min-width: 60px; display: inline-block;">最優先</span>';
      } else if (w >= 5) {
        weightBadgeHtml = '<span class="status-indicator fetching" style="background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); min-width: 60px; display: inline-block;">重要</span>';
      } else {
        weightBadgeHtml = '<span class="status-indicator success" style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.25); min-width: 60px; display: inline-block;">通常</span>';
      }

      row.innerHTML = `
        <td style="padding: 12px 8px; font-weight: 600; color: var(--text-primary);">${name}</td>
        <td style="padding: 12px 8px; color: var(--text-secondary); font-size: 11.5px;">${categoryNames[feed.category] || feed.category}</td>
        <td style="padding: 12px 8px; text-align: center;">${weightBadgeHtml}</td>
        <td style="padding: 12px 8px; text-align: center;">${statusBadge}</td>
        <td style="padding: 12px 8px; text-align: center; font-weight: 600; color: var(--text-primary); font-size: 13px;">${feed.articleCount}</td>
        <td style="padding: 12px 8px; color: var(--text-secondary); font-size: 11.5px;">${timeStr}</td>
        <td style="padding: 12px 8px;">${errorMsg}</td>
      `;

      if (feed.status === 'error') {
        const badge = row.querySelector('.status-indicator.error');
        if (badge) {
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            showToast(`${name} エラー: ${feed.error}`, 'error');
          });
        }
      }

      feedStatusTableBody.appendChild(row);
    });
  }

  const openFeedStatusModal = () => {
    feedStatusModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    loadFeedStatus();
  };

  const closeFeedStatusModal = () => {
    feedStatusModal.style.display = 'none';
    document.body.style.overflow = '';
    if (statusPollInterval) {
      clearInterval(statusPollInterval);
      statusPollInterval = null;
    }
  };

  // イベントバインディング
  if (headerLogoContainer) {
    headerLogoContainer.addEventListener('click', (e) => {
      e.preventDefault();
      openFeedStatusModal();
    });
  }

  if (feedStatusModalCloseBtn) {
    feedStatusModalCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFeedStatusModal();
    });
  }

  if (feedStatusModalOverlay) {
    feedStatusModalOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFeedStatusModal();
    });
  }

  // 手動リフレッシュボタン
  if (feedStatusRefreshBtn) {
    feedStatusRefreshBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      feedStatusRefreshBtn.disabled = true;
      feedStatusRefreshBtn.textContent = '更新をリクエスト中...';
      
      try {
        const res = await fetch('/api/refresh');
        const data = await res.json();
        showToast(data.message, 'success');
        
        // 収集開始に伴うポーリングのキック
        loadFeedStatus();
      } catch (err) {
        showToast('更新リクエストに失敗しました: ' + err.message, 'error');
        feedStatusRefreshBtn.disabled = false;
        feedStatusRefreshBtn.textContent = '今すぐ収集';
      }
    });
  }

  // 新規ソース登録フォームの開閉 (トグル)
  if (toggleAddSourceBtn && addSourceFormContainer) {
    toggleAddSourceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = addSourceFormContainer.style.display === 'none';
      addSourceFormContainer.style.display = isHidden ? 'flex' : 'none';
      toggleAddSourceBtn.querySelector('span').textContent = isHidden ? '➖ フォームを閉じる' : '➕ 新規ソースの登録';
      
      // メッセージやプレビューの初期化
      addSourceMessage.style.display = 'none';
      crawlerPreviewContainer.style.display = 'none';
    });
  }

  // クロール接続テストの実行
  if (btnTestCrawler) {
    btnTestCrawler.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = newFeedUrlInput.value.trim();
      if (!url) {
        showFormMessage('フィードURLを入力してください。', 'error');
        return;
      }

      btnTestCrawler.disabled = true;
      btnTestCrawler.textContent = '🔍 クロール中...';
      crawlerPreviewContainer.style.display = 'none';
      addSourceMessage.style.display = 'none';

      try {
        const res = await fetch('/api/feeds/preview-crawler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await res.json();
        btnTestCrawler.disabled = false;
        btnTestCrawler.textContent = '🔍 接続・クロールテスト';

        if (!res.ok || !data.success) {
          showFormMessage(data.message || 'クロールテストに失敗しました。', 'error');
          return;
        }

        // クロール結果の表示
        crawlerPreviewContainer.style.display = 'block';
        crawlerPreviewTitle.textContent = `最新記事: ${data.articleTitle}`;
        crawlerPreviewText.textContent = data.summary;

        if (data.isSkipped) {
          crawlerPreviewStatus.innerHTML = '⚠️ <span style="color: #f59e0b; font-weight: 700;">クロール制限ドメイン</span>';
          crawlerPreviewText.textContent = '（このドメインはスクレイピング制限があるため、RSS側の標準データのみを使用します。個別URLクロールは行いません）';
        } else if (data.isError) {
          crawlerPreviewStatus.innerHTML = '⚠️ <span style="color: #ef4444; font-weight: 700;">本文取得エラー (フォールバック)</span>';
        } else {
          crawlerPreviewStatus.innerHTML = '✅ <span style="color: #10b981; font-weight: 700;">クローラー正常稼働（要約抽出に成功）</span>';
        }

      } catch (err) {
        btnTestCrawler.disabled = false;
        btnTestCrawler.textContent = '🔍 接続・クロールテスト';
        showFormMessage('サーバーへの接続に失敗しました: ' + err.message, 'error');
      }
    });
  }

  // 新規フィードの登録
  if (btnSubmitFeed) {
    btnSubmitFeed.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = newFeedNameInput.value.trim();
      const url = newFeedUrlInput.value.trim();
      const category = newFeedCategoryInput.value;
      const weight = newFeedWeightInput.value;

      if (!name || !url) {
        showFormMessage('ソース名とフィードURLを入力してください。', 'error');
        return;
      }

      btnSubmitFeed.disabled = true;
      btnSubmitFeed.textContent = '💾 登録中...';
      addSourceMessage.style.display = 'none';

      try {
        const res = await fetch('/api/feeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, url, category, weight })
        });
        const data = await res.json();
        btnSubmitFeed.disabled = false;
        btnSubmitFeed.textContent = '💾 登録する';

        if (!res.ok || !data.success) {
          showFormMessage(data.message || '登録に失敗しました。', 'error');
          return;
        }

        showFormMessage(data.message, 'success');
        newFeedNameInput.value = '';
        newFeedUrlInput.value = '';
        
        // トースト表示
        showToast('新しいニュースソースを登録しました。', 'success');
        
        // 即座にフィードステータスを更新
        loadFeedStatus();

      } catch (err) {
        btnSubmitFeed.disabled = false;
        btnSubmitFeed.textContent = '💾 登録する';
        showFormMessage('サーバーへの登録要求に失敗しました: ' + err.message, 'error');
      }
    });
  }

  function showFormMessage(text, type) {
    addSourceMessage.style.display = 'block';
    addSourceMessage.textContent = text;
    if (type === 'success') {
      addSourceMessage.style.background = 'rgba(16,185,129,0.15)';
      addSourceMessage.style.color = '#10b981';
      addSourceMessage.style.border = '1px solid rgba(16,185,129,0.25)';
    } else {
      addSourceMessage.style.background = 'rgba(239,68,68,0.15)';
      addSourceMessage.style.color = '#ef4444';
      addSourceMessage.style.border = '1px solid rgba(239,68,68,0.25)';
    }
  }

  // ESCキーで閉じる
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && feedStatusModal.style.display === 'flex') {
      closeFeedStatusModal();
    }
  });


  // 表示モードの切り替え (ダッシュボード ⇄ タイムライン)
  if (viewModeToggle) {
    viewModeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentViewMode === 'dashboard') {
        currentViewMode = 'timeline';
        dashboardMain.style.display = 'none';
        timelineViewContainer.style.display = 'block';
        viewModeToggle.classList.add('active');
        viewModeToggleText.textContent = 'グリッド';
        viewModeToggle.title = 'グリッド表示に切り替え';
        
        // タイムラインのデータをロード
        loadTimeline();
      } else {
        currentViewMode = 'dashboard';
        dashboardMain.style.display = 'grid';
        timelineViewContainer.style.display = 'none';
        viewModeToggle.classList.remove('active');
        viewModeToggleText.textContent = 'タイムライン';
        viewModeToggle.title = 'タイムライン表示に切り替え';
        
        // 通常データを再読み込み
        loadData(true);
      }
    });
  }

  // =========================================================================
  // 📥 本格的3ペイン型 RSS リーダーのフロントエンド実装
  // =========================================================================

  // DOM 参照のマッピング
  const rssSidebar = document.getElementById('rss-sidebar');
  const rssFeedsAccordion = document.getElementById('rss-feeds-accordion');
  const rssArticleTimeline = document.getElementById('rss-article-timeline');
  const rssArticlesList = document.getElementById('rss-articles-list');
  const rssPreviewPane = document.getElementById('rss-preview-pane');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  const previewContentArea = document.getElementById('preview-content-area');
  
  const currentViewTitle = document.getElementById('current-view-title');
  const timelineCountLabel = document.getElementById('timeline-count-label');
  const totalUnreadCount = document.getElementById('total-unread-count');
  
  const menuAllUnread = document.getElementById('menu-all-unread');
  const menuBookmarks = document.getElementById('menu-bookmarks');
  const markAllReadBtn = document.getElementById('mark-all-read-btn');

  // プレビュー表示要素の参照
  const previewCategory = document.getElementById('preview-category');
  const previewPublisher = document.getElementById('preview-publisher');
  const previewDate = document.getElementById('preview-date');
  const previewTitle = document.getElementById('preview-title');
  const previewSummaryText = document.getElementById('preview-summary-text');
  const previewOriginalLink = document.getElementById('preview-original-link');
  const previewBtnChatgpt = document.getElementById('preview-btn-chatgpt');
  const previewBtnPerplexity = document.getElementById('preview-btn-perplexity');

  // RSS リーダーの内部状態
  let rssFeeds = {}; // APIからロードされるフィード一覧
  let rssArticles = []; // 現在ロードされている生の全記事一覧
  let activeFeedId = 'all'; // 現在選択されているフィードID/URL、または 'all', 'bookmarks'
  let activeCategory = 'all'; // 現在選択されているカテゴリ

  // RSS リーダーの初期ロード処理
  async function initRssReader() {
    try {
      // 1. フィード一覧の取得
      const feedRes = await fetch('/api/feeds?t=' + Date.now());
      const feedData = await feedRes.json();
      if (feedData.success) {
        rssFeeds = feedData.feeds;
      }

      // 2. 記事データのロード
      await loadRssArticles();

      // 3. サイドバー・未読数バッジ・リストの初期描画
      renderRssSidebar();
      renderRssArticles();

      // 4. 定期ポーリング（15秒おきに記事を自動更新）
      setInterval(async () => {
        await loadRssArticles();
        renderRssSidebar();
        renderRssArticles(false); // スクロール位置維持のため再レンダリングのみ
      }, 15000);

    } catch (err) {
      console.error('RSS Reader init failed:', err);
    }
  }

  // 記事データのAPIからの取得
  async function loadRssArticles() {
    try {
      const res = await fetch('/api/articles?limit=300&t=' + Date.now());
      const data = await res.json();
      if (data.success) {
        rssArticles = data.articles;
      }
    } catch (err) {
      console.error('Failed to load raw articles:', err);
    }
  }

  // 左サイドバー (フィードアコーディオン) の描画
  function renderRssSidebar() {
    if (!rssFeedsAccordion) return;
    rssFeedsAccordion.innerHTML = '';

    let totalUnread = 0;
    
    // 各フィードおよび全体の未読数を計算
    const unreadCounts = {};
    rssArticles.forEach(art => {
      const isRead = readNewsUrls.has(art.link);
      if (!isRead) {
        totalUnread++;
        unreadCounts[art.feedName] = (unreadCounts[art.feedName] || 0) + 1;
      }
    });

    // 全体未読数の更新
    if (totalUnreadCount) {
      totalUnreadCount.textContent = totalUnread;
      totalUnreadCount.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    }

    // ブックマーク数のバッジ更新
    const bookmarksBadge = document.getElementById('bookmarks-count');
    if (bookmarksBadge) {
      const bCount = userBookmarks.size;
      bookmarksBadge.textContent = bCount;
      bookmarksBadge.style.display = bCount > 0 ? 'inline-block' : 'none';
    }

    // カテゴリごとにフィードを整理してアコーディオン構築
    Object.keys(rssFeeds).forEach(category => {
      const feeds = rssFeeds[category];
      if (feeds.length === 0) return;

      const categoryGroup = document.createElement('div');
      categoryGroup.className = 'accordion-group';

      // カテゴリヘッダー
      const catHeader = document.createElement('div');
      catHeader.className = 'accordion-header';
      catHeader.innerHTML = `
        <span class="folder-icon mdi mdi-folder-outline"></span>
        <span class="category-name">${category}</span>
      `;

      const catList = document.createElement('ul');
      catList.className = 'accordion-list';

      feeds.forEach(f => {
        const unread = unreadCounts[f.name] || 0;
        const feedItem = document.createElement('li');
        feedItem.className = `feed-item${activeFeedId === f.url ? ' active' : ''}`;
        feedItem.setAttribute('data-feed-url', f.url);
        feedItem.innerHTML = `
          <img src="${getFaviconUrl(f.url)}" alt="" class="sidebar-feed-favicon" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' viewBox=\\\'0 0 24 24\\\'><circle cx=\\\'12\\\' cy=\\\'12\\\' r=\\\'8\\\' fill=\\\'%23666\\\'/></svg>'">
          <span class="feed-title">${f.name}</span>
          <span class="feed-badge"${unread > 0 ? ' style="display:inline-block;"' : ' style="display:none;"'}>${unread}</span>
        `;

        // フィードクリックイベント
        feedItem.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.feed-item, .sidebar-item').forEach(el => el.classList.remove('active'));
          feedItem.classList.add('active');
          activeFeedId = f.url;
          activeCategory = 'all';
          
          if (currentViewTitle) currentViewTitle.textContent = f.name;
          renderRssArticles();
        });

        catList.appendChild(feedItem);
      });

      // カテゴリヘッダーのクリックでアコーディオン開閉
      catHeader.addEventListener('click', () => {
        categoryGroup.classList.toggle('expanded');
      });

      // デフォルトで展開状態にする
      categoryGroup.classList.add('expanded');

      categoryGroup.appendChild(catHeader);
      categoryGroup.appendChild(catList);
      rssFeedsAccordion.appendChild(categoryGroup);
    });
  }

  // ニュースソースのURLから Favicon URL を取得するヘルパー
  function getFaviconUrl(url) {
    try {
      const parsed = new URL(url);
      return "https://www.google.com/s2/favicons?domain=" + parsed.hostname + "&sz=32";
    } catch (e) {
      return '';
    }
  }

  let rssScrollObserver = null;

  function initRssObserver() {
    if (rssScrollObserver) {
      rssScrollObserver.disconnect();
    }

    rssScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          const link = card.getAttribute('data-link');
          if (link && !readNewsUrls.has(link)) {
            markAsRead(link, card);
            const dot = card.querySelector('.unread-dot');
            if (dot) dot.remove();
            card.classList.add('is-read');
            renderRssSidebar();
          }
          rssScrollObserver.unobserve(card);
        }
      });
    }, {
      root: null, // ブラウザの表示領域全体を監視範囲とする
      rootMargin: '-5% 0px -5% 0px', // 上下の若干の内側に入った時点で検知
      threshold: 0.1 // 10% 以上が見えたら既読にする
    });
  }

  // キーボードショートカットで追跡する現在の選択インデックス
  let currentSelectedIndex = -1;
  let filteredArticlesListForKeys = []; // ショートカット処理で参照するフィルタされた現在の一覧

  // 中央ペイン (生のRSS記事リスト) の描画
  function renderRssArticles(resetScroll = true) {
    if (!rssArticlesList) return;
    
    // 現在のアクティブ表示に沿って記事をフィルタリング
    let filtered = [];

    if (activeFeedId === 'all') {
      filtered = [...rssArticles];
    } else if (activeFeedId === 'bookmarks') {
      filtered = rssArticles.filter(art => userBookmarks.has(art.link));
    } else {
      // 特定のフィードURLでフィルタリング
      filtered = rssArticles.filter(art => {
        const feedInfo = Object.values(rssFeeds).flat().find(f => f.url === activeFeedId);
        return art.feedName === (feedInfo?.name || '');
      });
    }

    filteredArticlesListForKeys = filtered; // キーボード移動用リストに同期

    if (timelineCountLabel) {
      timelineCountLabel.textContent = filtered.length + " 件の記事";
    }

    // スクロール位置の退避
    const scrollTop = rssArticlesList.scrollTop;
    rssArticlesList.innerHTML = '';

    if (filtered.length === 0) {
      rssArticlesList.innerHTML = '<div class="loading-placeholder">表示する記事がありません。</div>';
      currentSelectedIndex = -1;
      return;
    }

    filtered.forEach((item, index) => {
      const card = document.createElement('article');
      const isRead = readNewsUrls.has(item.link);
      const isBookmarked = userBookmarks.has(item.link);
      
      card.className = "rss-article-card" + (isRead ? " is-read" : "") + (item.image ? " has-image" : "");
      card.setAttribute('data-link', item.link);
      card.setAttribute('data-index', index);

      const pubDate = new Date(item.pubDate);
      const mm = String(pubDate.getMonth() + 1).padStart(2, '0');
      const dd = String(pubDate.getDate()).padStart(2, '0');
      const hh = String(pubDate.getHours()).padStart(2, '0');
      const min = String(pubDate.getMinutes()).padStart(2, '0');
      const formattedTime = mm + "/" + dd + " " + hh + ":" + min;

      const imageHtml = item.image ? `
        <div class="rss-card-image-wrapper">
          <img src="${item.image}" alt="${item.title}" class="rss-card-image" loading="lazy" onerror="this.parentNode.style.display='none'">
        </div>
      ` : '';

      // ChatGPT / Perplexity プロンプトURLバインド
      const chatGptPrompt = encodeURIComponent("「" + item.title + "」についてWEB検索を利用して記事の深掘りをして");
      const perplexityPrompt = encodeURIComponent("「" + item.title + "」について関連報道や進展をWEB検索を利用して深掘りして");

      // 2ペイン・アコーディオン展開型のHTML設計 (常時表示・ドット左上・注目度バッジ調整)
      card.innerHTML = `
        ${!isRead ? '<span class="unread-dot"></span>' : ''}
        <div class="rss-card-main-row">
          ${imageHtml}
          <div class="rss-card-content">
            <div class="rss-card-header">
              <div class="rss-card-header-left">
                <span class="rss-source-chip" data-feed-name="${item.feedName}">
                  <img src="${getFaviconUrl(item.link)}" alt="" class="rss-source-favicon">
                  <span>${item.feedName}</span>
                </span>
                ${item.weight ? `
                  <span class="rss-weight-badge" title="AI注目度スコア">
                    注目度: ${item.weight}
                  </span>
                ` : ''}
              </div>
              <span class="rss-card-time">${formattedTime}</span>
            </div>
            <h4 class="rss-card-title">
              ${item.title}
            </h4>
            <div class="rss-card-footer">
              <button class="bookmark-action-btn${isBookmarked ? ' active' : ''}" title="あとで読む">
                <span class="mdi ${isBookmarked ? 'mdi-bookmark' : 'mdi-bookmark-outline'}"></span>
              </button>
            </div>
          </div>
        </div>
        
        <!-- 常時表示詳細エリア -->
        <div class="rss-card-details-expanded">
          <div class="rss-details-section">
            <p class="rss-details-summary">${item.contentSnippet || '直接ニュースソースから詳細記事を参照してください。'}</p>
            <div class="rss-details-actions">
              <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="rss-details-primary-btn">
                一次ソースを開く <span class="mdi mdi-open-in-new"></span>
              </a>
              <div class="rss-details-deep-dive">
                <a href="https://chatgpt.com/?q=${chatGptPrompt}&hints=search" target="_blank" rel="noopener noreferrer" class="rss-details-dive-btn chatgpt">
                  <span class="mdi mdi-chat-outline"></span> ChatGPT
                </a>
                <a href="https://perplexity.ai/search?q=${perplexityPrompt}" target="_blank" rel="noopener noreferrer" class="rss-details-dive-btn perplexity">
                  <span class="mdi mdi-magnify"></span> Perplexity
                </a>
              </div>
            </div>
          </div>
        </div>
      `;

      // 記事フォーカス選択のハンドラ (常時表示のため開閉は不要、選択枠表示のみ)
      const selectAndExpandCard = () => {
        document.querySelectorAll('.rss-article-card').forEach(el => {
          el.classList.remove('selected');
        });
        card.classList.add('selected');
        currentSelectedIndex = index;
      };

      // ニュースソースChipクリックイベント（絞り込み）
      const sourceChip = card.querySelector('.rss-source-chip');
      if (sourceChip) {
        sourceChip.addEventListener('click', (e) => {
          e.stopPropagation(); // カード本体の開閉クリックイベントをキャンセル
          
          // そのフィード名に対応するフィードURLを探す
          const foundFeed = Object.values(rssFeeds).flat().find(f => f.name === item.feedName);
          if (foundFeed) {
            // サイドバーのアクティブクラスの移行
            document.querySelectorAll('.feed-item, .sidebar-item').forEach(el => el.classList.remove('active'));
            const sidebarTarget = document.querySelector(`[data-feed-url="${foundFeed.url}"]`);
            if (sidebarTarget) sidebarTarget.classList.add('active');
            
            activeFeedId = foundFeed.url;
            activeCategory = 'all';
            
            if (currentViewTitle) currentViewTitle.textContent = foundFeed.name;
            renderRssArticles();
          }
        });
      }

      // カード本体のクリックイベント
      card.addEventListener('click', (e) => {
        // ブックマークアクションボタンの場合はトグル
        if (e.target.closest('.bookmark-action-btn')) {
          e.stopPropagation();
          toggleBookmark(item.link, card.querySelector('.bookmark-action-btn'));
          renderRssSidebar();
          renderRssArticles(false);
          return;
        }

        // 展開アクションリンクは除外
        if (e.target.closest('.rss-card-details-expanded a')) {
          return;
        }

        selectAndExpandCard();
      });

      rssArticlesList.appendChild(card);
      
      // 生成した瞬間に直接スクロール交差監視に登録！
      if (rssScrollObserver && !isRead) {
        rssScrollObserver.observe(card);
      }
    });

    // キーボード移動によるフォーカスの再適用
    if (currentSelectedIndex >= 0 && currentSelectedIndex < filtered.length) {
      const activeCard = rssArticlesList.querySelector(`[data-index="${currentSelectedIndex}"]`);
      if (activeCard) {
        activeCard.classList.add('selected');
      }
    }

    if (!resetScroll) {
      rssArticlesList.scrollTop = scrollTop;
    }
  }

  // キーボードによるアイテムの選択移動とスクロール調整
  function moveSelection(direction) {
    if (filteredArticlesListForKeys.length === 0) return;
    
    let newIndex = currentSelectedIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= filteredArticlesListForKeys.length) newIndex = filteredArticlesListForKeys.length - 1;
    
    const targetCard = rssArticlesList.querySelector(`[data-index="${newIndex}"]`);
    if (targetCard) {
      // 1クリックイベントを模倣して展開・既読化
      targetCard.click();
      
      // 2. 表示エリア内にスクロールイン
      targetCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // グローバルキーボードショートカットハンドラー
  window.addEventListener('keydown', (e) => {
    // インプット入力欄などでタイピングしている場合はショートカットをバイパス
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    const currentItem = filteredArticlesListForKeys[currentSelectedIndex];

    switch (e.key.toLowerCase()) {
      case 'j':
      case 'arrowdown':
        e.preventDefault();
        moveSelection(1); // 次の記事へ
        break;
      case 'k':
      case 'arrowup':
        e.preventDefault();
        moveSelection(-1); // 前の記事へ
        break;
      case 'o':
      case 'enter':
      case 'v':
        if (currentItem) {
          e.preventDefault();
          window.open(currentItem.link, '_blank', 'noopener,noreferrer');
        }
        break;
      case 'b':
        if (currentItem && rssArticlesList) {
          e.preventDefault();
          const targetCard = rssArticlesList.querySelector(`[data-index="${currentSelectedIndex}"]`);
          if (targetCard) {
            const bBtn = targetCard.querySelector('.bookmark-action-btn');
            if (bBtn) bBtn.click(); // ブックマークトグルを模倣
          }
        }
        break;
      case 'c':
        if (currentItem) {
          e.preventDefault();
          const prompt = encodeURIComponent("「" + currentItem.title + "」についてWEB検索を利用して記事の深掘りをして");
          window.open("https://chatgpt.com/?q=" + prompt + "&hints=search", '_blank', 'noopener,noreferrer');
        }
        break;
      case 'p':
        if (currentItem) {
          e.preventDefault();
          const prompt = encodeURIComponent("「" + currentItem.title + "」について関連報道や進展をWEB検索を利用して深掘りして");
          window.open("https://perplexity.ai/search?q=" + prompt, '_blank', 'noopener,noreferrer');
        }
        break;
      case 'a':
        e.preventDefault();
        if (markAllReadBtn) {
          markAllReadBtn.click(); // すべて既読
        }
        break;
    }
  });

  // すべて既読にするボタンの処理
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', () => {
      let filtered = [];
      if (activeFeedId === 'all') {
        filtered = [...rssArticles];
      } else if (activeFeedId !== 'bookmarks') {
        filtered = rssArticles.filter(art => {
          const feedInfo = Object.values(rssFeeds).flat().find(f => f.url === activeFeedId);
          return art.feedName === (feedInfo?.name || '');
        });
      }

      filtered.forEach(item => {
        markAsRead(item.link);
      });

      renderRssSidebar();
      renderRssArticles();
    });
  }

  // --- 9. 初期読み込み ＆ ポーリング (30秒) ---
  loadData();
  initRssReader(); // 本格RSSリーダーの起動
  setInterval(loadData, 30000);
});

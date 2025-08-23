console.log("Start replace some elements...");
const API_KEY = "Bearer 6b564cb326a6443e819f41a37acf624f.9FJcTcLnPdcyCeJd";
const getPosts = async () => {
  if (localStorage.getItem("sitePostsInfo")) {
    return JSON.parse(localStorage.getItem("sitePostsInfo"));
  }
  const resp = await fetch("/posts.json");
  const siteData = await resp.json();

  const { posts, tags, categories } = siteData;
  const sitePostsInfo = {
    postsSize: posts.length,
    tagSize: tags.length,
    categorySize: categories.length,
  };
  localStorage.setItem("sitePostsInfo", JSON.stringify(sitePostsInfo));
  return sitePostsInfo;
};

async function renderSiteInfoCard() {
  const siteInfo = document.getElementById("site-info");
  if (!siteInfo) return;

  const { postsSize, tagSize, categorySize } = await getPosts();
  siteInfo.innerHTML = `
    <div id="site-info-card">
      <img id="site-info-avatar" src="/img/avatar.jpg" />
      <h2 id="site-info-title">Lxy's Blog</h2>
      <div id="site-info-table">
        <a href="/archives/">
          <div>文章</div>
          <div>${postsSize}</div>
        </a>
        <a href="/tags/">
          <div>标签</div>
          <div>${tagSize}</div>
        </a>
        <a href="/categories/">
          <div>分类</div>
          <div>${categorySize}</div>
        </a>
      </div>
    </div>
  `;
}

async function renderSummary() {
  const article = document.getElementById("article-container");
  if (!article) return;

  console.log(JSON.stringify(article.innerHTML));

  const response = await fetch(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: API_KEY,
      },
      body: JSON.stringify({
        model: "glm-4.5-flash",
        stream: true,
        messages: [
          {
            role: "user",
            content:
              "将下面一段对中的文本提取出摘要，只返回摘要内容，格式为纯文本，重要单词使用<code></code>包裹",
          },
          {
            role: "user",
            content: JSON.stringify(article.innerHTML),
          },
        ],
      }),
    }
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    console.log("Received chunk:", chunk);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderSiteInfoCard();
  renderSummary();
});

function updateCardSize() {
  const card = document.getElementById("site-info-card");
  if (!card) return;
  const screenWidth = window.innerWidth;

  // Linear scaling between mobile and desktop sizes
  let widthPercent;
  if (screenWidth <= 368) {
    widthPercent = 100;
  } else if (screenWidth >= 1200) {
    widthPercent = 50;
  } else {
    // Linear interpolation between 100% (at 368px) and 50% (at 1200px)
    widthPercent = 100 - ((screenWidth - 368) / (1200 - 368)) * 50;
  }

  card.style.width = widthPercent + "%";
}

window.addEventListener("resize", updateCardSize);

window.addEventListener("load", updateCardSize);

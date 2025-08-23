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

async function* fetchSummary(content) {
  try {
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
          thinking: {
            type: "disabled",
          },
          stream: true,
          messages: [
            {
              role: "user",
              content:
                "将下面一段对中的文本提取出摘要，只返回摘要内容，格式为纯文本，重要单词使用<code></code>包裹",
            },
            {
              role: "user",
              content: content,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        result += chunk;
        let lines = result.split("\n");
        result = lines.pop();

        for (let line of lines) {
          if (!line.trim()) continue;
          if (line.includes("[DONE]")) continue;

          line = line.replace(/^data: /, "");
          try {
            const json = JSON.parse(line);
            if (
              json.choices &&
              json.choices[0].delta &&
              json.choices[0].delta.content
            ) {
              yield json.choices[0].delta.content;
            }
          } catch (parseError) {
            console.debug("Failed to parse line:", line);
          }
        }
      }

      // Handle any remaining data
      if (result && !result.includes("[DONE]")) {
        const cleanResult = result.replace(/^data: /, "");
        if (cleanResult.trim()) {
          try {
            const json = JSON.parse(cleanResult);
            if (
              json.choices &&
              json.choices[0].delta &&
              json.choices[0].delta.content
            ) {
              yield json.choices[0].delta.content;
            }
          } catch (parseError) {
            console.debug("Failed to parse remaining data:", cleanResult);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error("Error in fetchSummary:", error);
    yield "摘要生成失败: " + error.message;
  }
}

async function renderSummary() {
  const article = document.getElementById("article-container");
  if (!article) return;

  const summaryCard = document.createElement("div");
  const summaryContainer = document.createElement("div");
  const summaryContent = document.createElement("div");
  summaryCard.id = "article-summary-card";
  summaryContainer.id = "article-summary";
  summaryContent.id = "summary-content";
  const summaryTitle = `<strong id="summary-title">文章摘要</strong><br>`;
  summaryContainer.innerHTML = `${summaryTitle}`;
  summaryContainer.appendChild(summaryContent);
  summaryCard.appendChild(summaryContainer);

  article.parentNode.insertBefore(summaryCard, article);

  // 获取文章内容
  const articleContent = article.innerHTML;

  // 使用 for await...of 遍历生成器函数
  let summaryText = "";
  try {
    for await (const chunk of fetchSummary(articleContent)) {
      summaryText += chunk;
      // 实时更新显示
      summaryContent.innerHTML = `${summaryText}`;
    }

    if (!summaryText.trim()) {
      summaryContent.innerHTML = "无法生成摘要";
    }
  } catch (error) {
    console.error("Error rendering summary:", error);
    summaryContent.innerHTML = "摘要生成失败";
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

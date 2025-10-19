const API_KEY = "Bearer 6b564cb326a6443e819f41a37acf624f.9FJcTcLnPdcyCeJd";
/**
 * 不要生成文章摘要
 * @param {*} content
 * @returns
 */
// hexo.extend.filter.register("after_post_render", async function (data) {
//   let summaryCard = await renderSummary(data.content);
//   summaryCard = summaryCard.replace("*", "");
//   data.content = `${summaryCard}${data.content}`;
//   return data;
// });

async function fetchSummary(content) {
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

  if (response && response.ok) {
    const json = await response.json();
    return await json.choices[0].message.content;
  }
}

async function renderSummary(text) {
  const summaryContent = await fetchSummary(text);

  const summaryTitle = `<strong id="summary-title">文章摘要</strong><br>`;
  return `<div id="article-summary-card">
    <div id="article-summary">
      ${summaryTitle}
      <div id="summary-content">${summaryContent}</div>
    </div>
  </div>`;
}

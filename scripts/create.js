// hexo.extend.generator.register("posts-json", function (locals) {
//   const postsData = locals.posts.map((post) => ({
//     title: post.title,
//     date: post.date.format("YYYY-MM-DD"), // Hexo 自带 moment.js
//     tags: post.tags.map((t) => t.name),
//     categories: post.categories.map((c) => c.name),
//     url: post.permalink,
//   }));
//   const siteData = {
//     posts: postsData,
//     tags: [...new Set(postsData.map((post) => post.tags).flat())],
//     categories: [...new Set(postsData.map((post) => post.categories).flat())],
//   };
//   return [
//     {
//       path: "posts.json",
//       data: siteData,
//     },
//   ];
// });

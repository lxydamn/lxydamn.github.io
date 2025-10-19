---
title: 基于AC自动机构建网络违规词屏蔽
description: 通过Aho-Corasick Automaton 实现文本中违规词的屏蔽
date: 2025-09-19 13:38:29
tags:
  - 字符串匹配
categories:
  - algorithm
---

# 引言

在很多的场景中，系统需要对一些用户输入的一些特定文本进行检测和处理，不同的场景对于检测效率又有不同，例如：游戏、聊天系统通常要求更强的实时性，针对一些关键性的词语进行屏蔽，评论、文章之类的文本检测往往不需要这么强的实时性，但对于语义的检测也有一定的要求。

本篇文章基于 AC 自动机，实现了文本串中的关键词屏蔽。

# 算法简介

AC 自动机(Aho-Corasick Automaton) 是贝尔实验室于 1975 年发明著名的多模字符串匹配算法——AC 自动机。AC 自动机在实现上要依托于 Trie 树（也称字典树）并借鉴了 KMP 模式匹配算法的核心思想。

## Trie 树

Trie 树是一种用于存储字符串的树形数据结构，Trie 树中的每个节点都表示一个字符，并且每个节点都包含一个指向下一个字符的指针。这种数据结构可以存储大量模板串，高效的进行匹配，Trie 树通常用于实现字符串匹配算法，如字典查找、自动补全、 spell checker 等。

### Java 实现

Trie 树的实现比较简单，下是关键代码 put 和 contains 方法：

```java

/**
 * Trie树（前缀树）实现类
 *
 * <p>
 * Trie是一种树形数据结构，用于高效地存储和检索字符串数据集中的键。 主要应用场景包括：自动补全、拼写检查、IP路由、T9输入法等。
 * </p>
 *
 * <p>
 * 该实现支持以下操作：
 * <ul>
 * <li>插入单词</li>
 * <li>查找单词</li>
 * <li>查找前缀</li>
 * <li>删除单词</li>
 * </ul>
 * </p>
 *
 * @author lxy2914344878@163.com
 * @since 2025/9/16 10:23
 */
@Data
public class Trie {
    private TrieNode root;
    private long count;
    /**
     * Trie树节点内部类
     */
    private static class TrieNode {
        /**
         * 节点对应的字符值
         */
        public Character val;
        /**
         * 子节点映射表，键为字符，值为对应的子节点
         */
        public Map<Character, TrieNode> children;
        /**
         * 标记该节点是否为某个单词的结尾
         */
        public boolean word;
        /**
         * 默认构造函数，创建一个空节点
         */
        public TrieNode() {
            children = new HashMap<>();
            word = false;
        }
        /**
         * 带字符值的构造函数
         * @param c 节点对应的字符
         */
        public TrieNode(char c) {
            this.val = c;
            children = new HashMap<>();
            word = false;
        }
    }
    /**
     * 构造函数，初始化根节点
     */
    public Trie() {
        root = new TrieNode();
    }
    /**
     * 插入单个单词到Trie树中
     * @param word 需要插入的单词
     * @throws IllegalArgumentException 当单词为null或空字符串时抛出
     */
    public void put(String word) {
        if (word == null || word.isEmpty()) {
            return;
        }
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            if (!node.contains(c)) {
                node.put(c);
            }
            node = node.get(c);
        }
        // 只有当该节点还不是单词结尾时才增加计数
        if (!node.word) {
            node.word = true;
            count++;
        }
    }
    /**
     * 判断Trie树中是否包含指定的单词
     * @param word 需要查找的单词
     * @return 包含返回true，否则返回false
     */
    public boolean contains(String word) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            if (!node.contains(c)) {
                return false;
            }
            node = node.get(c);
        }
        return node != null && node.word;
    }
    /**
     * 判断Trie树中是否有以指定前缀开头的单词
     * @param prefix 需要查找的前缀
     * @return 存在返回true，否则返回false
     */
    public boolean startsWith(String prefix) {
        TrieNode node = root;
        for (char c : prefix.toCharArray()) {
            if (!node.contains(c)) {
                return false;
            }
            node = node.get(c);
        }
        return node != null;
    }
}

```

## KMP 算法

KMP 算法是一种用于字符串匹配的算法，KMP 算法在朴素匹配的思路上，利用模板串的共同前后缀，失配时通过跳过部分匹配串，加速匹配。KMP 算法的关键是构建模板串的 Next 数组，在失配时通过 Next 数组快速跳过匹配串。

### 构建 Next 数组

```
  s="absababcababa"
  p="ababa"
```

求最长共同前后缀 LPS

```java
  int[] next = new int[p.length()];
  next[0] = 0;
  int i = 0, j = 1;
  while (j < p.length()) {
      if (p.charAt(i) == p.charAt(j))  next[j ++] = ++ i;
      else {
          if (i != 0) i = next[i - 1];
          else {
              next[i] = 0;
              j++;
          }
      }
  }
```

### 匹配过程

匹配过程

```java
  int i = j = 0;
  while (i < s.length()) {
      if (s.charAt(i) == p.charAt(j)) {
          i++;
          j++;
      }
      if (j == p.length()) {
          System.out.println(i - j);
          j = next[j - 1];
      } else if (i < s.length() && s.charAt(i) != p.charAt(j)) {
          if (j != 0) {
              j = next[j - 1];
          } else {
              i++;
          }
      }
  }
```

**_每次匹配失败，当前模板串回退到 Next[j - 1]_**

## AC 自动机

AC 自动机基于 Trie，增加了 fail 指针，与 KMP 类似的，每次失配时不需要从根节点重新查询，而是从当前节点的 fail 指针开始查询，从而优化了 Trie 树的查询效率。

### fail 指针

🔍 核心思想：fail 指针维护的是 `最长公共后缀 = 某个模式串的前缀`

基于此，AC 自动机才能快速完成多模板串的匹配。

AC 自动机的构建过程基本与 Trie 树一致，多一步 fail 指针的构建

构建 fail 指针采用层序遍历

1. 第一层节点的 fail 指针全部指向 root
2. 按层遍历，找到距离最近的失配节点

构建 fail 节点的代码如下：

```java
private static void buildFailPointer(Node root) {
  Queue<Node> queue = new LinkedList<>();

  // 初始化第一层节点的失配指针指向根节点
  for (Map.Entry<Character, Node> entry : root.children.entrySet()) {
      entry.getValue().fail = root;
      queue.offer(entry.getValue());
  }

  while (!queue.isEmpty()) {
      Node cur = queue.poll();

      for (Map.Entry<Character, Node> entry : cur.children.entrySet()) {
          Node child = entry.getValue();
          Node fail = cur.fail;

          // 找到最近的失配节点
          while (fail != null && !fail.containsKey(entry.getKey())) {
              fail = fail.fail;
          }

          if (fail == null) {
              child.fail = root;
          } else {
              child.fail = fail.get(entry.getKey());
          }

          queue.offer(child);
      }
  }
}
```

### 匹配过程

查询过程同 KMP 算法一样，从根节点开始，根据输入的字符串进行匹配，如果当前节点没有匹配字符则沿 fail 指针回溯，直到根节点或者匹配成功。由于 fail 指针维护的是最长共同后缀 = 某个模式串的前缀，所以节省的就是这部分前缀的匹配时间。

这里返回的是匹配结果的索引，可以根据需要调整返回结果。

代码如下：

```java
public List<Map.Entry<Integer, Integer>> search(String text) {
  List<Map.Entry<Integer, Integer>> result = new ArrayList<>();
  Node cur = root;
  for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      // 如果当前节点没有匹配字符，则沿着失配指针回溯
      while (cur != root && !cur.containsKey(c)) {
          cur = cur.fail;
      }
      // 如果找到了匹配字符，则移动到子节点
      if (cur.containsKey(c)) {
          cur = cur.get(c);
      }
      // 检查当前节点及其失配路径上的节点是否为终止节点
      for (int pid : cur.outputs) {
          int start = i - words.get(pid).length() + 1;
          result.add(new AbstractMap.SimpleEntry<>(start, i + 1));
      }
  }
  return result;
}
```

全量代码：

```java
import java.util.*;

/**
 * <p>
 * AC 自动机
 * </p>
 *
 * @author lxy2914344878@163.com
 * @since 2025/9/18 13:40
 */
public class AhoCorasick {
    private final Node root;
    private final List<String> words;

    public AhoCorasick() {
        root = new Node(0);
        words = new ArrayList<>();
    }

    private static class Node {
        public Map<Character, Node> children;
        public boolean isEnd;
        public Node fail;
        public int depth;
        public List<Integer> outputs;

        public Node(int depth) {
            this.children = new HashMap<>();
            this.outputs = new ArrayList<>();
            this.isEnd = false;
            this.fail = null;
            this.depth = depth;
        }

        public Node get(char c) {
            return children.get(c);
        }

        public void put(char c, Node node) {
            children.put(c, node);
        }

        public void remove(char c) {
            children.remove(c);
        }

        public boolean containsKey(char c) {
            return children.containsKey(c);
        }
    }

    public static AhoCorasick build(String... words) {
        return build(List.of(words));
    }

    public static AhoCorasick build(Collection<String> words) {
        AhoCorasick ahoCorasick = new AhoCorasick();
        // 构建 Trie 树
        for (String word : words) {
            Node cur = ahoCorasick.root;
            for (int i = 0; i < word.length(); i++) {
                char c = word.charAt(i);
                if (!cur.containsKey(c)) {
                    Node node = new Node(cur.depth + 1);
                    cur.put(c, node);
                }
                cur = cur.get(c);
            }
            cur.isEnd = true;
            ahoCorasick.words.add(word);
            cur.outputs.add(ahoCorasick.words.size() - 1);
        }

        // 构建失配指针
        buildFailPointer(ahoCorasick.root);

        return ahoCorasick;
    }

    private static void buildFailPointer(Node root) {
        Queue<Node> queue = new LinkedList<>();

        // 初始化第一层节点的失配指针指向根节点
        for (Map.Entry<Character, Node> entry : root.children.entrySet()) {
            entry.getValue().fail = root;
            queue.offer(entry.getValue());
        }

        while (!queue.isEmpty()) {
            Node cur = queue.poll();
            for (Map.Entry<Character, Node> entry : cur.children.entrySet()) {
                Node child = entry.getValue();
                Node fail = cur.fail;
                // 找到最近的失配节点
                while (fail != null && !fail.containsKey(entry.getKey())) {
                    fail = fail.fail;
                }

                if (fail == null) {
                    child.fail = root;
                } else {
                    child.fail = fail.get(entry.getKey());
                }
                queue.offer(child);
            }
        }
    }

    /**
     * 在文本中查找所有匹配的模式串
     *
     * @param text 待匹配文本
     * @return 匹配结果列表，每个元素为(模式串, 起始位置)
     */
    public List<Map.Entry<Integer, Integer>> search(String text) {
        List<Map.Entry<Integer, Integer>> result = new ArrayList<>();
        Node cur = root;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            // 如果当前节点没有匹配字符，则沿着失配指针回溯
            while (cur != root && !cur.containsKey(c)) {
                cur = cur.fail;
            }
            // 如果找到了匹配字符，则移动到子节点
            if (cur.containsKey(c)) {
                cur = cur.get(c);
            }
            // 检查当前节点及其失配路径上的节点是否为终止节点
            for (int pid : cur.outputs) {
                int start = i - words.get(pid).length() + 1;
                result.add(new AbstractMap.SimpleEntry<>(start, i + 1));
            }
        }
        return result;
    }
}
```

# 违规词屏蔽器

基于上述 AC 自动机，就可以很轻松地实现一个违规词屏蔽器。

## 构建违规词库

违规词库的构建比较随意，可以使用文件也可以使用数据库，按需构建。

读取词库内容，得到一个字符串数组，然后构建 AC 自动机。

## 屏蔽内容处理

主要方式是接收一个本文字符串，调用实现的 AC 自动机的匹配方法得到一个区间列表，通过这个区间列表，将匹配到的内容替换为 `*`。

### 合并区间

AC 自动机是从左至右匹配的，所有得到的区间结果一定是按左边界有序的。

```java
private List<Map.Entry<Integer, Integer>> mergeEdge(List<Map.Entry<Integer, Integer>> list) {
  List<Map.Entry<Integer, Integer>> merge = new ArrayList<>();
  int l = -1, r = -1;
  for (Map.Entry<Integer, Integer> entry : list) {
      if (l == -1) {
          l = entry.getKey();
          r = entry.getValue();
      } else {
          if (entry.getKey() <= r) {
              r = Math.max(r, entry.getValue());
          } else {
              merge.add(new AbstractMap.SimpleEntry<>(l, r));
              l = entry.getKey();
              r = entry.getValue();
          }
      }
  }
  merge.add(new AbstractMap.SimpleEntry<>(l, r));
  return merge;
}
```

### 替换违规文本

```java
private String maskByBoundary(String text, int start, int end) {
  if (text == null || text.isBlank()) {
      return text;
  }
  if (start < 0 || end > text.length() || start >= end) {
      return text;
  }
  return text.substring(0, start) + "*".repeat(end - start) + text.substring(end);
}
```

# 总结

1. 对于 AC 自动机来说，缺点是构建时间长、占用内存多，针对小规模词库性能还是足够的。若要优化空间，还有基于数组的更加紧凑的实现方式，但是冲突时的 resize 操作成本较高。

2. 对于评论、文章类型的文本，还是建议使用基于机器学习的模型来对文本进行处理。

3. 该版 AC 自动机的实现还待优化，动态重构还待实现。

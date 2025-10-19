---
title: Git命令笔记
date: 2025-09-02 19:21:12
tags:
  - git
categories:
  - others
---

{% note info simple %}
[GIT 官方中文文档](https://git-scm.com/book/zh/v2)
{% endnote %}

# 压缩提交

在 `Git` 中 `squash` 并不是一个命令，而是一个关键词。它允许使用 `rebase` 命令将多个提交合并为一个提交。

{% note info warning %}
但在使用时，应确保压缩的分支没有被其他分支引用，防止分支混乱！
{% endnote %}

**使用指南**：

1. 检查历史记录：使用 `git log` 命令查看提交记录。
   `git log --oneline --graph`，`--oneline` 将信息显示在一行中

2. 选择需要合并的提交：使用 `git rebase -i` 命令
   `git rebase -i HEAD~<COUNT>`，`COUNT` 表示需要合并的提交数量
   执行上述命令后，会进入编辑器中，将记录前的 `pick` 改为 `s` 或 `squash`，保存更改。

{% note info warning %}
`squash` 必须 紧跟在一个 `pick` 或 `reword` 等可被保留的提交之后
{% endnote %}

3. 更新提交信息

第二步执行之后，会新打开一个文本编辑器来确认提交，修改信息后保存退出。

# 本地回滚

在本地使用 Git 时， Git 会在后台保存一个引用日志（reflog）， 引用日志记录了最近几个月你的 HEAD 和分支引用所指向的历史。

1. 查看 reflog
   `git reflog`

2. 回滚到指定版本
   `git reset [--hard] <commit-hash>`
   --hard 强制回滚，不使用--hard 可以保留修改
   commit-hash 为指定版本的 SHA-1，最低数量为 4 位

# WorkTree

应用场景：在一个分支已经进行了很多修改，但是还没有提交，但是又想切换到其他分支，这时就可以使用 WorkTree。在 WorkTree 创建的工作区中进行修改互不影响

```shell
git worktree add [-f] [--detach] [--checkout] [--lock [--reason <string>]]
                   [--orphan] [(-b | -B) <new-branch>] <path> [<commit-ish>]
git worktree list [-v | --porcelain [-z]]
git worktree lock [--reason <string>] <worktree>
git worktree move <worktree> <new-path>
git worktree prune [-n] [-v] [--expire <expire>]
git worktree remove [-f] <worktree>
git worktree repair [<path>…​]
git worktree unlock <worktree>
```

# 暂存代码

`git stash` 命令, 作用：临时保存当前工作区和暂存区的修改，使你可以干净地切换分支或执行其他操作，之后再恢复这些修改。

1. `git stash` 保存当前修改（不包括未跟踪文件）
2. `git stash list` 列出所有保存的修改
3. `git stash apply` 恢复保存的修改
4. `git stash pop` 删除保存的修改

{% note info warning %}
新增加的文件不会被跟踪，若存在新增文件，需要先使用 `git add`
{% endnote %}

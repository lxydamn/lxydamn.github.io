---
title: 一些不错的脚本
description: 收录的一些减轻工作量的Shell或Python脚本
date: 2025-09-11 21:19:21
tags:
  - Script
categories:
  - others
---

# 多项目分支修改统计(Shell)

## 简要介绍

大型项目通常会有多个 `git` 仓库，在快速迭代开发的过程中，短期会产生大量分支，而某些分支又涉及到多个项目，一到 CI/CD 时就非常容易遗漏项目的分支。在遵循规范的项目，此脚本能快速根据 `git commit message` 筛选出对于的项目。

## 使用规约

1. 所有 `git` 项目在同一个父目录下，且 `.git` 文件夹在项目下
2. `git commit message` 中包含分支编号
   例如
   分支名称：feature-create
   提交信息："[feature-create] 新增创建功能"
3. 脚本位置放在父目录下

## 脚本

[点击下载 Shell 脚本文件](/scripts/search_git_project.sh)

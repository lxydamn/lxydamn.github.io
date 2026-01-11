---
title: jenkins 使用笔记
description: jenkins 使用笔记, 包含了安装、配置、部署以及部分使用说明
date: 2026-01-1 10:00:00
tags:
  - Jenkins
  - CI/CD
categories:
  - tools
---

# 概述

持续集成（CI）是现代开发流程中的核心环节，而 Jenkins 作为一款开源的 CI 工具，凭借简单安装、开箱即用、插件丰富、易于扩展等优势，成为开发者的首选工具。

本文从零开始在 linux 系统上搭建 Jenkins 并部署一个测试项目，旨在通过该过程来学习 jenkins 的基本使用。

# 实验环境

| 操作系统 | CPU | 内存 | 磁盘空间 | 环境                    |
| -------- | --- | ---- | -------- | ----------------------- |
| CentOS 7 | 8C  | 16G  | 100G     | VMware Workstation 17.6 |

## 环境说明

CentOS 7 的官方已在 2024 年 6 月 30 日停止维护，在安装的过程中可能存在各种问题，使用 Ubuntu、Debian 等系统可能更为简单方便。

## 配置说明

官方的基本配置要求如下：

| 配置        | 内存 | 磁盘空间       |
| ----------- | ---- | -------------- |
| Minimum     | 256M | 1G(Docker 10G) |
| Recommended | 4G + | 50G            |

需要说明的是，Jenkins 的配置对于不同的项目构建需求会有所不同，因此需要根据实际情况进行配置，推荐 `4C + 8G` 以上。

# Jenkins 安装

Jenkins 官方文档 [https://www.jenkins.io/doc/book/](https://www.jenkins.io/doc/book/)

jenkins 主要有三种安装方式：

## Docker 安装

```bash
docker run -d --ulimit nofile=65536:65536 \
 -v /apps/docker/jenkins_home:/var/jenkins_home \
 -p 9090:8080 -p 50000:50000 \
 --restart=always \
 -e JAVA_OPTS=-Duser.timezone=Asia/Shanghai \
 --name jenkins \
 --privileged=true \
 jenkins/jenkins
```

如果需要配置 Docker In Docker 需要额外挂载一些参数, 使容器内的 Jenkins 可以操作宿主机的 Docker

```bash
 -v /var/run/docker.sock:/var/run/docker.sock \
 -v /usr/bin/docker:/usr/bin/docker \
 -v /usr/local/bin/docker-compose:/usr/local/bin/docker-compose \
```

如果需要配置 LTS，参考官方文档。

## 软件包安装

jenkins 本身也是 Java 应用，所以需要 JRE 来运行

JDK17 链接：[https://download.java.net/java/GA/jdk17.0.1/2a2082e5a09d4267845be086888add4f/12/GPL/openjdk-17.0.1_linux-x64_bin.tar.gz](https://download.java.net/java/GA/jdk17.0.1/2a2082e5a09d4267845be086888add4f/12/GPL/openjdk-17.0.1_linux-x64_bin.tar.gz)

Jenkins 链接：[https://mirrors.jenkins-ci.org/redhat/jenkins-2.497-1.1.noarch.rpm](https://mirrors.jenkins-ci.org/redhat/jenkins-2.497-1.1.noarch.rpm)

```bash

# 解压
tar -zxf openjdk-17.0.1_linux-x64_bin.tar.gz -C /usr/local

# 配置环境变量（可选，后续可通过配置文件实现）
export JAVA_HOME=/usr/local/jdk-17.0.1
export PATH=$JAVA_HOME/bin:$PATH

# 使配置生效
source /etc/profile

# 安装Jenkins
yum localinstall jenkins-2.497-1.1.noarch.rpm -y

# 新版jenkins配置文件
# vi /usr/lib/systemd/system/jenkins.service
# 注意：使用不同的用户安装Jenkins需要注意
User=jenkins
Group=jenkins

# 配置文件jdk配置（默认是注释掉的，未配置jdk环境变量时会报错）
# The Java home directory. When left empty, JENKINS_JAVA_CMD and PATH are consulted.
Environment="JAVA_HOME=/usr/local/jdk-17.0.1"

# 启动jenkins
sudo systemctl daemen-reload
sudo systemctl start jenkins
# 查看启动状态，并获取初始密码
sudo systemctl status jenkins
# 1月 10 21:19:57 localhost.localdomain jenkins[78055]: 031c679f961142a0a8184b9cac3cdfd1
# 1月 10 21:19:57 localhost.localdomain jenkins[78055]: This may also be found at: /var/lib/jenkins/secrets/initialAdminPassword
```

## war 安装

下载 war 文件 [https://get.jenkins.io/war-stable/2.479.1/jenkins.war](https://get.jenkins.io/war-stable/2.479.1/jenkins.war)

直接执行 `java -jar jenkins.war`

更具体的部署说明可以参考官方的文档 [https://www.jenkins.io/doc/book/installing/war-file/](https://www.jenkins.io/doc/book/installing/war-file/)

## 访问 Jenkins

安装完成后，访问 `http://localhost:8080`，通过初始日志中输出的密码进入 Jenkins。

# Jenkins 配置

## 插件安装

初始登录 jenkins 时，会提示安装插件。完成之后，后续想要拓展插件，也可以通过 Manage Jenkins -> Manage Plugins -> Available Plugins 中安装更多的插件

常用插件：

1. GitLab
   通常是自搭建的 GitLab，大家根据自己情况下载其他仓库管理
2. Extended Choice Parameter
   它允许我们在构建过程中动态地设置和传递参数。对于需要用户输入或者动态选择的参数，我们可以使用多选框、单选框等来呈现
3. Stage View
   它是一个插件，用于在构建过程中显示构建的阶段和任务，并显示每个任务的状态和进度。

## 工具配置

在 Manage Jenkins -> Tools 中进行配置

1. Maven
   可自动下载，也可以手动下载二进制包，并指定路径
2. JDK
   与 maven 类似

## 凭证信息

在 Manage Jenkins -> Credentials 中进行配置

Jenkins 一般通过 git 拉取项目代码再进行部署，为了保证 token 的安全性，可以通过凭证信息进行配置，之后在项目构建中，可以通过凭证信息进行获取。

# Pipeline 使用

Jenkins Pipeline 是 Jenkins 的一个扩展，它允许我们使用 Groovy 语言来定义构建过程，并使用 Jenkins 的各种插件来执行任务。Pipeline 的主要优点是它可以实现更灵活的构建过程，并且可以轻松地集成其他工具和系统。

---
title: glowroot 监控安装部署
description: glowroot 简单安装、部署流程记录
date: 2026-01-1 10:00:00
tags:
  - Jenkins
  - CI/CD
categories:
  - tools
---

官方 github 地址：[https://github.com/glowroot/glowroot](https://github.com/glowroot/glowroot)，

WIKI：[https://github.com/glowroot/glowroot/wiki](https://github.com/glowroot/glowroot/wiki)

# 简介

glowRoot 工具是一款轻量级、低开销的 Java 应用性能监控工具（APM），主要用于追踪 Java 应用的请求执行链路、方法耗时、JDBC 执行耗时。核心实现基于 Java Agent、字节码增强技术。

# 部署模式

glowRoot 支持两种部署方式

## 模式一：嵌入式（Embedded）

监控数据写入本地数据库或**<font style="color:rgb(6, 10, 38);">Cassandra（一款开源的分布式 NoSQL 数据库）, WebUI </font>**<font style="color:rgb(6, 10, 38);">内置在本地，只适合单机服务</font>

## <font style="color:rgb(6, 10, 38);">模式二：中心化（Central）</font>

<font style="color:rgb(6, 10, 38);">多个应用实例将数据发送到 </font>**<font style="color:rgb(6, 10, 38);">Glowroot Central</font>**<font style="color:rgb(6, 10, 38);">（独立服务），Central 使用 </font>**<font style="color:rgb(6, 10, 38);">Cassandra</font>**<font style="color:rgb(6, 10, 38);"> 作为后端存储。</font>

# 安装

## Docker 部署

### 安装 Central

docker-compose.yml

```yaml
services:
  glowroot:
    image: glowroot/glowroot-central:0.14.4
    container_name: glowroot
    environment:
      - CASSANDRA_CONTACT_POINTS=cassandra
    ports:
      - "8181:8181" # agent端口
      - "4000:4000" # UI
    networks:
      - glowroot_net

  cassandra:
    container_name: cassandra
    image: cassandra:4.1.5
    ports:
      - "7000:7000/tcp"
      - "9042:9042/tcp" # 数据端口
    networks:
      - glowroot_net

networks:
  glowroot_net:
```

### 安装 agent

下载 agent [https://github.com/glowroot/glowroot/releases/download/v0.14.4/glowroot-0.14.4-dist.zip](https://github.com/glowroot/glowroot/releases/download/v0.14.4/glowroot-0.14.4-dist.zip)

基本文件结构

```yaml
lib/
└── glowroot/
├── lib/
│   ├── glowroot-central-collector-https-linux.jar
│   ├── glowroot-central-collector-https-osx.jar
│   ├── glowroot-central-collector-https-windows.jar
│   ├── glowroot-embedded-collector.jar
│   └── glowroot-logging-logstash.jar
│
├── logs/
│   └── glowroot.2026-01-15.log
│
├── tmp/
│   ├── lock
│   ├── plugin-pointcuts.jar
│   └── preload-some-super-types-cache
│
├── config.json
├── config.synced
├── glowroot.jar
├── glowroot.properties
├── LICENSE
└── NOTICE
```

#### 启动

```yaml
# 启动时添加参数  agent.id 为可选，collector.address必填
java -jar --javaagent=path/to/glowroot.jar \
   —Dglowroot.agent.id=xxxx \
   -Dglowroot.collector.address=http://hostname:port


# 也可以编辑properties文件
agent.id=xxxxx
collector.address=http://hostname:port
```

## 本地部署

本地部署同理，修改相应的 jvm 参数即可

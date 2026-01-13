---
title: MySQL 主从复制部署
description: Ubuntu22.04 LTS下 MySQL 8.0.44 主从复制部署
date: 2026-01-13 10:00:00
tags:
  - Database
  - MySQL
categories:
  - database
---

# 概述

搭建 MySQL 主从复制（Master-Slave Replication）是实现高可用、读写分离和数据备份的常用方案，本文档基于 MySQL 8.0 搭建主从环境

# 实验环境

| OS               | CPU | RAM | disk size | IP address     |
| ---------------- | --- | --- | --------- | -------------- |
| Ubuntu 22.04 LTS | 2   | 4G  | 20G       | 192.168.43.130 |
| Ubuntu 22.04 LTS | 2   | 4G  | 20G       | 192.168.43.131 |
| Ubuntu 22.04 LTS | 2   | 4G  | 20G       | 192.168.43.132 |

# MySQL 安装

## 下载 MySQL8.0.44

[https://cdn.mysql.com//Downloads/MySQL-8.0/mysql-8.0.44-linux-glibc2.28-x86_64.tar.xz](https://cdn.mysql.com//Downloads/MySQL-8.0/mysql-8.0.44-linux-glibc2.28-x86_64.tar.xz)

## 安装 MySQL

```bash
# 解压
tar -xvf mysql-8.0.32-linux-glibc2.12-x86_64.tar.xz

# 移动
mv mysql-8.0.44-linux-glibc2.28-x86_64 /usr/local/mysql

# 添加到环境变量
echo "export PATH=/usr/local/mysql/bin:$PATH" >> /etc/profile
source /etc/profile
```

### 创建 mysql 用户

```bash
# 创建用户组
groupadd mysql
# 创建mysql用户
useradd -r -g mysql -s /bin/false mysql

# 创建数据、日志、临时目录
mkdir -p /data/mysql/{data, logs, temp}

# 授权
chown -R mysql:mysql /data/mysql
chown -R mysql:mysql /usr/local/mysql
```

### 初始化 MySQL 数据库

```bash
sudo -u mysql /usr/local/mysql/bin/mysqld --initialize \
--basedir=/usr/local/mysql \
--datadir=/data/mysql/data
```

从日志中获取到初始密码，后续进入 mysql 更新密码

| 机器           | root 密码      |
| -------------- | -------------- |
| 192.168.43.130 | pZ0w!UFT:lKq   |
| 192.168.43.131 | 8Pq8jjZ!Ocp\*  |
| 192.168.43.132 | mh\*td=\_#Y8:Y |

### 修改 Root 密码并创建一个用户

```bash
ALTER USER 'root'@'localhost' IDENTIFIED BY '123456';

create user 'zeon'@'%' IDENTIFIED BY '123456';

GRANT ALL PRIVILEGES ON *.* TO 'zeon'@'%' WITH GRANT OPTION;

FLUSH PRIVILEGES;
```

## 配置 System Service

```bash
[Unit]
Description=MySQL 8.0 Service
After=network.target

[Service]
User=mysql
Group=mysql
Type=notify
ExecStart=/usr/local/mysql/bin/mysqld --defaults-file=/etc/my.cnf
LimitNOFILE=65535
Restart=on-failure
RestartPreventExitStatus=1
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

# 主从配置

## 主库

### 配置 my.cnf

```bash
[mysqld]
# 基础设置
server-id = 1
bind-address = 0.0.0.0

# 数据目录
datadir = /data/mysql/data
socket = /data/mysql/tmp/mysql.sock

# 启用二进制日志（必须！）
log-bin = /data/mysql/logs/binlog
binlog_format = ROW
expire_logs_days = 7
max_binlog_size = 100M

# 可选：确保 InnoDB 安全
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1

gtid_mode = ON
enforce_gtid_consistency = ON

[client]
socket = /data/mysql/tmp/mysql.sock
```

### 创建复制用户

```sql
# 复制用户
create user 'repl'@'%' IDENTIFIED by 'zeon@Repl!';

GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';

FLUSH PRIVILEGES;
```

### 记录主表 binlog 位置

后续配置从库时需要

```sql
# 加锁
FLUSH TABLES WITH READ LOCK;
# 打印Master状态，获取binlog_file, binlog_pos
SHOW MASTER STATUS;

+---------------+----------+--------------+------------------+------------------------------------------+
| File          | Position | Binlog_Do_DB | Binlog_Ignore_DB | Executed_Gtid_Set                        |
+---------------+----------+--------------+------------------+------------------------------------------+
| binlog.000002 |      856 |              |                  | 6de4ea5d-efa8-11f0-972e-000c2994ae00:1-7 |
+---------------+----------+--------------+------------------+------------------------------------------+
```

## 从库

### 配置 my.cnf

```bash
[mysqld]
# 必须与主库不同！
server-id = 2
bind-address = 0.0.0.0

# 数据目录（确保已初始化）
datadir = /data/mysql/data
basedir = /usr/local/mysql
socket = /data/mysql/tmp/mysql.sock

# 中继日志（Relay Log）
relay-log = /data/mysql/logs/relay-bin
relay-log-index = /data/mysql/logs/relay-bin.index

gtid_mode = ON
enforce_gtid_consistency = ON

# 只读（防止误写，可选但推荐）
read_only = 1

[client]
socket = /data/mysql/tmp/mysql.sock
```

### 启动复制

```sql
# 配置从库所在服务的hosts
echo "192.168.43.130 mysql-master" | sudo tee /etc/hosts

# master_log_file，master_log_pos需要从主表的记录中读取
change master to master_host='mysql-master', \
  master_user='repl', \
  master_password='zeon@Repl!', \
  master_log_file='binlog.000002', \
  master_log_pos=856;

# 开始从库复制
START SLAVE;
```

## 检查

```sql
# 切换至主库关闭锁
UNLOCK TABLES;

# 查看从库状态
SHOW SLAVE STATUS\G

# 查看两结果是否正常
# Slave_IO_Running: Yes
# Slave_SQL_Running: Yes
```

---
title: Spring, Mybatis 拦截器的基本使用
date: 2025-12-23 18:00:00
tags:
  - Spring
  - Mybatis
description: 在Spring中对Mybatis拦截器的基本使用
categories:
  - spring
---

Mybatis 的拦截器(Plugins)是一个非常有用的一个特性，可以在 Mybatis 操作数据库的生命周期中添加自定义的一些逻辑，非常适合用于做一些数据操作的记录、数据脱敏等功能

# Mybatis 的生命周期

Mybatis 中 Executor、ParameterHandler、StatementHandler、ResultSetHandler 是 SQL 执行生命周期的四个关键节点，分别对应 Mybatis 中的四个接口。

# 拦截器

Interceptor 是 Mybatis 提供的一个拦截器接口，定义了三个方法，通过 intercept 方法对 Mybatis 生命周期中的节点进行拦截，并返回结果。

```java

public interface Interceptor {
    Object intercept(Invocation invocation) throws Throwable;

    default Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }

    default void setProperties(Properties properties) {
    }
}

```

## 拦截器注解

上述接口需要结合@Intercepts，@Signature 两个注解来完成对方法的拦截

```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE})
public @interface Intercepts {
    Signature[] value();
}
```

```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({})
public @interface Signature {
    Class<?> type();

    String method();

    Class<?>[] args();
}
```

@Signature 注解用于指定拦截的方法，包括拦截的类、方法、参数。

三个参数就是 Executor、ParameterHandler、StatementHandler、ResultSetHandler 接口中对应类型、方法名以及参数类型

type: 拦截的类
method: 拦截的方法
args: 拦截的参数类型

示例：

```java

/**
 * StatementHandler接口源代码
 */
public interface StatementHandler {
    Statement prepare(Connection connection, Integer transactionTimeout) throws SQLException;

    void parameterize(Statement statement) throws SQLException;

    void batch(Statement statement) throws SQLException;

    int update(Statement statement) throws SQLException;

    <E> List<E> query(Statement statement, ResultHandler resultHandler) throws SQLException;

    <E> Cursor<E> queryCursor(Statement statement) throws SQLException;

    BoundSql getBoundSql();

    ParameterHandler getParameterHandler();
}

/**
 * 以拦截prepare、getBoundSql方法为例
 */
@Intercepts({
		@Signature(
				type = StatementHandler.class,
				method = "prepare",
				args = {java.sql.Connection.class, java.lang.Integer.class}
		),
		@Signature(
				type = StatementHandler.class,
				method = "getBoundSql",
				args = {}
		)
})
```

## 拦截器方法

```java

public interface Interceptor {
    Object intercept(Invocation invocation) throws Throwable;

    default Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }

    default void setProperties(Properties properties) {
    }
}

```

### intercept

intercept 是拦截器的核心方法，proceed 方法会调用被拦截的方法，返回结果会作为 intercept 方法的返回值。

Invocation 参数内部三个参数，target: 被拦截的对象, method: 被拦截的方法, args: 方法的参数

一个核心的方法 proceed() 调用被拦截的方法

### plugin

plugin 方法用于为目标对象创建代理对象，决定是否需要对目标对象进行拦截处理。

### setProperties

setProperties 方法用于接收配置文件中设置的属性参数，实现拦截器的可配置化。

---
title: Spring,Mybatis 多数据源以及动态数据源配置
date: 2025-11-08 18:00:00
tags:
  - Spring
  - Mybatis
description: 在Spring、Mybatis 中配置多个数据源以及动态数据源的方法
categories:
  - spring
---

# 前言

多数据源是应用系统需要同时配置多个数据库连接，根据业务需要选择使用哪个数据库连接。在 Spring/MyBatis/JPA 体系中，
通常是主从数据库/多个独立数据库

在 Spring/Mybatis/MyBatis-Plus 项目中，可以通过配置数据源，以一种类似于声明式的方式来获取数据库连接，交由连接池管理。Mybatis 通过 SqlSessionFactory/SqlSessionTemplate 来选择数据源。

Mybatis 可以针对不同的 Mapper 接口，绑定不同数据源，所以就有了多数据源和动态数据源的配置方法，这两种配置方式有一定的区别。

## 测试环境

1. SpringBoot 3
2. MybatisPlus
3. MySQL8
4. Postgresql 14

# 多数据源配置

Spring 中通过 Bean 的方式来配置数据源，在配置 Bean 之前需要引入连接数据库的属性

```yaml
spring:
  application:
    name: system
  datasource:
    pgsql:
      driver-class-name: org.postgresql.Driver
      url: jdbc:postgresql://localhost:5432/db?useSSL=false&serverTimezone=Asia/ShanghacharacterEncoding=UTF-8&allowPublicKeyRetrieval=true
      username: admin
      password: 123456
    mysql:
      url: jdbc:mysql://localhost:3306/db?useUnicode=true&characterEncoding=utf-8allowPublicKeyRetrieval=TRUE
      username: root
      password: 123456
      driver-class-name: com.mysql.cj.jdbc.Driver
```

在配置数据源之前，需要简单了解 Mybatis

在 Spring 环境中，MyBatis 的核心组件有三层：

| 组件                | 职责                                  |
| ------------------- | ------------------------------------- |
| `DataSource`        | 数据库连接池，管理 JDBC 连接          |
| `SqlSessionFactory` | 创建 `SqlSession`（操作数据库的会话） |
| `Mapper` 接口       | 映射 SQL 与 Java 方法                 |

**@MapperScan 注解**
@MapperScan 是一个 Spring 的扫描器注解，它的工作由 MapperScannerRegistrar 实现，它会将指定的包下的所有接口，给它们创建 Mapper 代理的 Bean(MapperFactoryBean)。这个 Bean 最终依赖一个 SqlSessionFactory，用来执行 SQL

而 Mapper 到 SqlSessionFactory 之间，还存在 SqlSessionTemplate，它是 MyBatis 的线程安全代理，封装了 SqlSession 的创建、释放、事务管理逻辑。

在@MapperScan 中，可以指定 sqlSessionTemplateRef、sqlSessionFactoryRef 来创建的 Mapper 代理对象使用指定的 SqlSessionTemplate、SqlSessionFactory，从而指定 Mapper 中的 SQL 语句执行在指定的数据源中。

## 自动绑定数据源

{% note info simple %}

这种方式实现的关键在于将操作不同数据库的 Mapper 放在指定的包下，并指定对应的数据源。这样做的好处在于，以一种约定的方式绑定不同数据源，而无需关心其他。

{% endnote %}

{% tabs multi-datasource %}

<!-- tab MySqlDataSourceConfig -->

```java
@Configuration
@MapperScan(
		basePackages = "com.zeon.**.ms_mapper",
		sqlSessionTemplateRef = "mySqlSqlSessionTemplate",
		sqlSessionFactoryRef = "mySqlSqlSessionFactory"
)
public class MySqlDataSourceConfig {

	@Bean
	@ConfigurationProperties(prefix = "spring.datasource.mysql")
	public DataSourceProperties mysqlDataSourceProperties() {
		return new DataSourceProperties();
	}

	@Bean
	public DataSource mySqlDataSource(DataSourceProperties mysqlDataSourceProperties) {
		return mysqlDataSourceProperties.initializeDataSourceBuilder().build();
	}

	@Bean
	public SqlSessionFactory mySqlSqlSessionFactory(DataSource mySqlDataSource) throws Exception {
		// PS：如果项目引入的是Mybatis，则需要使用SqlSessionFactoryBean
		// SqlSessionFactoryBean bean = new SqlSessionFactoryBean();
		MybatisSqlSessionFactoryBean bean = new MybatisSqlSessionFactoryBean();
		bean.setDataSource(mySqlDataSource);
		bean.setMapperLocations(new PathMatchingResourcePatternResolver()
				.getResources("classpath*:ms_mapper/**/*.xml"));
		return bean.getObject();
	}

	@Bean
	public SqlSessionTemplate mySqlSqlSessionTemplate(SqlSessionFactory mySqlSqlSessionFactory) {
		return new SqlSessionTemplate(mySqlSqlSessionFactory);
	}

	@Bean
	public DataSourceTransactionManager mySqlTransactionManager(DataSource mySqlDataSource) {
		return new DataSourceTransactionManager(mySqlDataSource);
	}
}

```

<!-- endtab -->

<!-- tab PgSqlDataSourceConfig -->

```java

@Configuration
@MapperScan(
		basePackages = "com.zeon.**.mapper",
		sqlSessionTemplateRef = "pgSqlSqlSessionTemplate",
		sqlSessionFactoryRef = "pgSqlSqlSessionFactory"
)
public class PgSqlDataSourceConfig {

	@Bean
	@ConfigurationProperties(prefix = "spring.datasource.pgsql")
	public DataSourceProperties pgSqlDataSourceProperties() {
		return new DataSourceProperties();
	}

	@Bean
	public DataSource pgSqlDataSource(DataSourceProperties pgSqlDataSourceProperties) {
		return pgSqlDataSourceProperties.initializeDataSourceBuilder().build();
	}

	@Bean
	@ConfigurationProperties(prefix = "mybatis.configuration")
	public MybatisConfiguration configuration() {
		return new MybatisConfiguration();
	}

	@Bean
	public SqlSessionFactory pgSqlSqlSessionFactory(DataSource pgSqlDataSource,
													MybatisConfiguration configuration,
													@Value("${mybatis.mapper-locations}") String mapperLocations)
			throws Exception {
    // PS：如果项目引入的是Mybatis，则需要使用SqlSessionFactoryBean
		// SqlSessionFactoryBean bean = new SqlSessionFactoryBean();
		MybatisSqlSessionFactoryBean bean = new MybatisSqlSessionFactoryBean();
		bean.setDataSource(pgSqlDataSource);
		bean.setConfiguration(configuration);
		bean.setMapperLocations(new PathMatchingResourcePatternResolver()
				.getResources(mapperLocations));
		return bean.getObject();
	}

	@Bean
	public SqlSessionTemplate pgSqlSqlSessionTemplate(SqlSessionFactory pgSqlSqlSessionFactory) throws SQLException {
		return new SqlSessionTemplate(pgSqlSqlSessionFactory);
	}

	@Bean
	public DataSourceTransactionManager transactionManager(DataSource pgSqlDataSource) {
		return new DataSourceTransactionManager(pgSqlDataSource);
	}
}

```

<!-- endtab -->

{% endtabs %}

## 动态数据源

在上面的配置中，如果要在不同数据库中执行相同的 SQL 语句，那么就要在两套数据库中创建相同的 Mapper 接口，这样，如果要切换数据源，那么就要在代码中手动切换数据源，非常麻烦。而动态数据源则可以在运行过程中动态切换数据源来执行同一 SQL 语句，非常灵活。

### AbstractRoutingDataSource

Spring 提供了 AbstractRoutingDataSource 抽象类，用作路由代理 DataSource。

其核心思想：

AbstractRoutingDataSource 本身是 DataSource 的代理，实现 getConnection() 等方法，内部基于 lookup key 选择目标数据源，determineCurrentLookupKey()，返回一个“键”（lookup key），Spring 根据这个键从内部映射（map）取出实际的 DataSource 并委托调用。

实现这个 determineCurrentLookupKey()很简单，关键在于如何通过 Key 来取出 targetDataSources 中的对应的数据源，这里使用 ThreadLocal

```java

public class DynamicDataSource extends AbstractRoutingDataSource {
	@Override
	protected Object determineCurrentLookupKey() {
		return DynamicDataSourceHolder.get();
	}
}

public class DynamicDataSourceHolder {

	public static enum DataSourceType {
		MYSQL, PGSQL
	}

	private static final ThreadLocal<DataSourceType> CONTEXT = new ThreadLocal<DataSourceType>();

	public static void set(DataSourceType type) {
		CONTEXT.set(type);
	}

	public static DataSourceType get() {
		return CONTEXT.get();
	}

	public static void clear() {
		CONTEXT.remove();
	}
}

```

### 核心配置

```java

@Configuration
public class DynamicDataSourceConfig {

	@Bean
	public DataSource dynamicDataSource(
			DataSource mySqlDataSource,
			DataSource pgSqlDataSource
	) {

		Map<Object, Object> targetDataSources = new HashMap<>();
		targetDataSources.put(DynamicDataSourceHolder.DataSourceType.MYSQL, mySqlDataSource);
		targetDataSources.put(DynamicDataSourceHolder.DataSourceType.PGSQL, pgSqlDataSource);

		DynamicDataSource dynamicRoutingDataSource = new DynamicDataSource();
		dynamicRoutingDataSource.setDefaultTargetDataSource(pgSqlDataSource);
		dynamicRoutingDataSource.setTargetDataSources(targetDataSources);

		return dynamicRoutingDataSource;
	}
}

```

现在，这两个数据源就可以简单的配置了。

{% tabs multi-datasource %}

<!-- tab MySqlDataSourceConfig -->

```java
@Configuration
public class MySqlDataSourceConfig {

	@Bean
	@ConfigurationProperties(prefix = "spring.datasource.mysql")
	public DataSourceProperties mysqlDataSourceProperties() {
		return new DataSourceProperties();
	}

	@Bean
	public DataSource mySqlDataSource(DataSourceProperties mysqlDataSourceProperties) {
		return mysqlDataSourceProperties.initializeDataSourceBuilder().build();
	}
}

```

<!-- endtab -->

<!-- tab PgSqlDataSourceConfig -->

```java

@Configuration
public class PgSqlDataSourceConfig {

	@Bean
	@ConfigurationProperties(prefix = "spring.datasource.pgsql")
	public DataSourceProperties pgSqlDataSourceProperties() {
		return new DataSourceProperties();
	}

	@Bean
	public DataSource pgSqlDataSource(DataSourceProperties pgSqlDataSourceProperties) {
		return pgSqlDataSourceProperties.initializeDataSourceBuilder().build();
	}

	@Bean
	@ConfigurationProperties(prefix = "mybatis.configuration")
	public MybatisConfiguration configuration() {
		return new MybatisConfiguration();
	}
}

```

<!-- endtab -->

{% endtabs %}

最后还要配置 Mybatis 配置

```java

@Configuration
@MapperScan(basePackages = "com.zeon", sqlSessionTemplateRef = "sqlSessionTemplate")
public class MyBatisConfig {

	@Bean
	@ConfigurationProperties(prefix = "mybatis")
	public MybatisConfiguration mybatisConfiguration() {
		MybatisConfiguration configuration = new MybatisConfiguration();
		configuration.setMapUnderscoreToCamelCase(true);
		return configuration;
	}

	@Bean
	public SqlSessionFactory sqlSessionFactory(@Qualifier("dynamicDataSource") DataSource dataSource,
											   MybatisConfiguration mybatisConfiguration) throws Exception {
		MybatisSqlSessionFactoryBean factoryBean = new MybatisSqlSessionFactoryBean();
		factoryBean.setConfiguration(mybatisConfiguration);
		factoryBean.setDataSource(dataSource);
		return factoryBean.getObject();
	}

	@Bean
	public SqlSessionTemplate sqlSessionTemplate(@Qualifier("sqlSessionFactory") SqlSessionFactory sqlSessionFactory) {
		return new SqlSessionTemplate(sqlSessionFactory);
	}
}


```

# 事务问题

在默认情况下，Spring 的事务是通过 DataSourceTransactionManager 控制的，每个数据源对应一个事务管理器，如果没有正确指定，Spring 无法确定使用哪个事务管理器，可能导致事务不生效或使用错误的数据源。

所以在业务方法涉及多个数据源时，则需要手动控制。单数据源需要指定事务管理器，又或者使用分布式事务管理器。

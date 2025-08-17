---
title: 基于AOP、MyBatis的通用查询增强
date: 2025-08-17 09:12:11
tags: 
  - AOP
  - MyBatis
categories: 业务增强
---

{% note info simple %}
Github: [https://github.com/lxydamn/zeon/tree/master/bd-enhancer](https://github.com/lxydamn/zeon/tree/master/bd-enhancer)
{% endnote %}

# 问题场景

在大多数业务场景中，表通常会关联多个表，比如用户表和角色表，用户表和权限表等等。
在查询用户信息时，如果不在 SQL 中写关联，则会在业务逻辑中编写关联逻辑，随着业务量的增长，实体类不断增多，关联的逻辑也会不断增加，这时候不仅要在业务逻辑中编写这部分关联逻辑，还有业务本身的逻辑，那么代码量就会非常的大。

举例：

```java
@Override
	public void generateHeaderInfo(List<InvoiceHeader49722> invoiceHeaders) {
		// 获取公司
		List<String> companyList = invoiceHeaders.stream().map(InvoiceHeader49722::getCompanyCode)
                        .distinct().collect(Collectors.toList());
        Map<String, FndCompany> longFndCompanyMap = companyRepository.selectMapByCodes(companyList);
		// 获取员工
		List<String> employeeList = invoiceHeaders.stream().map(InvoiceHeader49722::getEmployeeCode)
                        .distinct().collect(Collectors.toList());
		Map<String, ExpEmployee> longExpEmployeeMap = expEmployeeRepository.selectMapByIds(employeeList);
		// 获取单位
		List<String> unitList = invoiceHeaders.stream().map(InvoiceHeader49722::getUnitCode)
                        .distinct().collect(Collectors.toList());
		Map<String, ExpOrgUnit> longHfbsUnitMap = unitRepository.selectUnitMapByIds(unitList);
		// 获取岗位
		List<String> postionList = invoiceHeaders.stream().map(InvoiceHeader49722::getPositionCode)
                        .distinct().collect(Collectors.toList());
		Map<String, ExpOrgPosition> longHfbsPositionMap = positionRepository.selectMapByIds(postionList);
		// 获取核算主体
		List<String> aeList = invoiceHeaders.stream().map(InvoiceHeader49722::getAccountingEntityCode)
                        .distinct().collect(Collectors.toList());
		Map<String, GldAccountingEntity> accountingEntityMap = accountingEntityRepository.selectMapByIds(aeList);
		// 获取货币
		List<String> currencyList = invoiceHeaders.stream().map(InvoiceHeader49722::getCurrencyTypeCode)
                        .distinct().collect(Collectors.toList());
		Map<String, GldCurrency> longGldCurrencyMap = currencyRepository.selectMapByIds(currencyList);
		// 发票类型
		List<String> typeList = invoiceHeaders.stream().map(InvoiceHeader49722::getInvoiceTypeCode)
                        .distinct().collect(Collectors.toList());
		Map<String, AcpMoInvoiceType> longAcpMoInvoiceTypeMap = invoiceTypeRepository.selectMapByIds(typeList);

		// 交易方式
		List<String> methodList = invoiceHeaders.stream().map(InvoiceHeader49722::getTransactionMethodCode)
				.collect(Collectors.toList());
		Map<String, CshPaymentMethod> longCshPaymentMethodMap = cshPaymentMethodRepository.selectMapByIds(methodList);

		invoiceHeaders.forEach(item -> {
            item.setCompanyName(Optional.ofNullable(longFndCompanyMap.get(item.getCompanyCode()))
                            .map(FndCompany::getCompanyShortName).orElse("未知公司"));

            item.setEmployeeName(Optional.ofNullable(longExpEmployeeMap.get(item.getEmployeeCode()))
                            .map(ExpEmployee::getName).orElse("未知员工"));

            item.setUnitName(Optional.ofNullable(longHfbsUnitMap.get(item.getUnitCode()))
                            .map(ExpOrgUnit::getDescription).orElse("未知单位"));

            item.setPositionName(Optional.ofNullable(longHfbsPositionMap.get(item.getPositionCode()))
                            .map(ExpOrgPosition::getDescription).orElse("未知职位"));

            item.setAccountingEntityName(Optional.ofNullable(accountingEntityMap.get(item.getAccountingEntityCode()))
                            .map(GldAccountingEntity::getAccEntityName).orElse("未知实体"));

            item.setCurrencyType(Optional.ofNullable(longGldCurrencyMap.get(item.getCurrencyTypeCode()))
                            .map(GldCurrency::getCurrencyName).orElse("未知币种"));

            item.setInvoiceTypeName(Optional.ofNullable(longAcpMoInvoiceTypeMap.get(item.getInvoiceTypeCode()))
                            .map(AcpMoInvoiceType::getDescription).orElse("未知发票类型"));

            item.setTransactionMethod(Optional.ofNullable(longCshPaymentMethodMap.get(item.getTransactionMethodCode()))
                            .map(CshPaymentMethod::getDescription).orElse("未知支付方式"));
		});

	}
```

# 基本解决思路

## `AOP`

Spring 中提供了 AOP 切面，AOP(Aspect-Oriented Programming)是面向切面的一种编程思想，其含义是把遍布应用程序的横切关注点（cross-cutting concern）提取出来，并封装成可重用的模块，从而将应用程序的关注点（concern）分离开，AOP 的实现是基于动态代理技术。
在 Spring 中，可以使用 `@Aspect` 注解定义切面，并使用 `@Pointcut` 注解定义切点，然后使用` @Before、@After、@AfterReturning、@AfterThrowing、@Around` 等注解定义通知。

在上述问题中，需要用到的即是 `@AfterReturning` 注解，该注解用于定义返回后执行的通知。

## `MyBatis` 通用查询

MyBatis 是一个优秀的持久层框架，它的一个核心优势就是提供了强大的动态 SQL 能力。这使得开发者可以根据不同的条件灵活地构建 SQL 语句

在这个场景中，只需要使用 `@SelectProvider` 这个注解，这个注解无需编写 xml，在方法中即可完成**动态**SQL 的构建

## 小结

结合 AOP 和 MyBatis 的功能，解决方案的大致框架已经有了，如下：

1. 创建一个切面，在查询方法返回时，拦截返回的数据
2. 使用 MyBatis 构建动态 SQL，获取需要关联的数据
3. 将获取的数据赋值到返回的数据中

上述的框架只大致描述了基本过程，但缺少具体的细节，这里进行补充：

1. 创建`@CrossQuery`注解，该注解用于标注需要进行数据关联的查询方法，作为 AOP 的切点
2. 创建`@CrossQueryField`、`@CrossQueryEntity` 注解，该注解用于标注实体类的外键，属性需要填写关联的属性名称、关联的表名、关联的列名等参数
3. 通过**反射**获取上述注解中的参数，并构建动态 SQL，将获取的数据赋值给返回的数据

# 实现

## 前置条件

### 依赖引入

```xml
  <dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
  </dependency>
  <dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
    <version>3.0.5</version>
  </dependency>
  <dependency>
    <groupId>com.alibaba.fastjson2</groupId>
    <artifactId>fastjson2</artifactId>
    <version>2.0.35</version>
  </dependency>
```

### 数据库样例

```sql
create table role
(
    id          bigint auto_increment
        primary key,
    role        varchar(10)  null,
    role_name   varchar(30)  null,
    description varchar(256) null,
    constraint role
        unique (role)
);

create table users
(
    id       bigint auto_increment
        primary key,
    username varchar(100) not null,
    password varchar(200) not null,
    role     varchar(10)  not null,
    nickname varchar(10)  not null
);

```

### 实体类创建

```java
public class Users extends BaseDomain implements Serializable {
    private static final long serialVersionUID = 438491303269108393L;

    private Long id;

    private String username;

    private String password;
    /** 外键 */
    @CrossQueryField(tableName = "role", keyField = "role", valueField = "roleName")
    @CrossQueryEntity(keyField = "role", tableName = "role", valueField = "roleObj")
    private String role;

    private String nickname;
    /** 关联查询目标 */
    private String roleName;
    /** 关联实体类 */
    private Role roleObj;‘

    ... Getter Setter...
}
```

## 注解定义

```java
/**
 * <p>
 *  描述:  跨表查询字段注解
 *  AOP 切点
 * </p>
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface CrossQuery {

}

/**
 * 描述：关联查询实体类注解
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface CrossQueryEntity {
	/**
	 * key字段名
	 */
	String keyField();

	/**
	 * 表名
	 */
	String tableName();

	/**
	 * value字段名，查询目标
	 */
	String valueField();
}

/**
 * 关联查询字段注解
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface CrossQueryField {
	/**
	 * Key 字段
	 */
	String keyField();

	/**
	 * key Table 字段
	 */
	String tableKeyField() default "";

	/**
	 * Value 字段
	 */
	String valueField();

	/**
	 * Value Table 字段
	 */
	String tableValueField() default "";

	/**
	 * tableName
	 */
	String tableName();
}

```

## Mapper 定义以及动态 SQL 构建

```java

@Mapper
public interface CommonDbEnhancedMapper {
	/**
	 * 通用K,V型查询
	 * @param tableName tableName
	 * @param keyField keyFieldName
	 * @param valueField valueFieldValue
	 * @param list 实体列表
	 * @return list
	 * @param <T> Entity
	 */
	@SelectProvider(value = CommonProvider.class, method = "selectListUseKeyValue")
	@MapKey("_xxy")
	<T> Map<Object, JSONObject> selectListUseKeyValue(List<T> list, String tableName, String keyField, String valueField);

	/**
	 * 通用K,V型查询
	 * @param tableName tableName
	 * @param keyField keyFieldName
	 * @param list 实体列表
	 * @return list
	 * @param <T> Entity
	 */
	@SelectProvider(value = CommonProvider.class, method = "selectMap")
	@MapKey("_xxy")
	<T> Map<Object, JSONObject> selectMap(List<T> list, String tableName, String keyField);
}

/**
 * SQL 构建类
 */
public class CommonProvider {

	public static <T> String selectListUseKeyValue(List<T> list, String tableName, String keyField, String valueField) {
		StringBuilder sql = new StringBuilder();
		// Generate keys
		String ids = SqlUtils.getIds(list, keyField);
		String tableKey = SqlUtils.camelToUnderline(keyField);
		String tableValue = SqlUtils.camelToUnderline(valueField);
		sql.append("SELECT ")
				.append(tableKey)
				.append(" AS _xxy")
				.append(",")
				.append(tableValue)
				.append(" AS value")
				.append(" FROM ")
				.append(tableName)
				.append(" WHERE ")
				.append(keyField)
				.append(" IN (")
				.append(ids)
				.append(")");

		return sql.toString();
	}

	public static <T> String selectMap(List<T> list, String tableName, String keyField) {
		StringBuilder sql = new StringBuilder();

		String ids = SqlUtils.getIds(list, keyField);
		String tableKey = SqlUtils.camelToUnderline(keyField);

		sql.append("SELECT * ,")
				.append(tableKey)
				.append(" AS _xxy")
				.append(" FROM ")
				.append(tableName)
				.append(" WHERE ")
				.append(tableKey)
				.append(" IN (")
				.append(ids)
				.append(")");

		return sql.toString();
	}
}
/**
 * SqlUtils 工具类
 */
public class SqlUtils {
	/**
	 *
	 * @param list entity's list
	 * @param fieldName entity field name
	 * @return "v1,v2,v3"
	 * @param <T> clazz
	 */
	public static <T> String getIds(List<T> list, String fieldName) {
		if (CollectionUtils.isEmpty(list)) {
			return null;
		}
		Class<?> clazz = list.get(0).getClass();
		Field field = ReflectUtils.getField(clazz, fieldName);
		if (field == null) {
			return null;
		}
		field.setAccessible(true);
		boolean isString = field.getType().equals(String.class);
		String result =  list.stream().map(item -> ReflectionUtils.getField(field, item))
				.filter(Objects::nonNull)
				.map(item -> String.format("'%s'", item))
				.distinct()
				.collect(Collectors.joining(","));

		if (!StringUtils.hasLength(result)) {
			return null;
		}
		return result;
	}

	/**
	 * 驼峰转下划线
	 * @param camelCaseStr 驼峰字符串
	 * @return 下划线字符串
	 */
	public static String camelToUnderline(String camelCaseStr) {
		if (camelCaseStr == null || camelCaseStr.isEmpty()) {
			return camelCaseStr;
		}
		StringBuilder sb = new StringBuilder();
		for (int i = 0; i < camelCaseStr.length(); i++) {
			char c = camelCaseStr.charAt(i);
			if (Character.isUpperCase(c)) {
				// 如果不是第一个字符，前面加下划线
				if (i > 0) {
					sb.append('_');
				}
				sb.append(Character.toLowerCase(c));
			} else {
				sb.append(c);
			}
		}
		return sb.toString();
	}
}

```

## 切面实现

```java

@Aspect
@Component
public class CrossQueryAspect {

	private static final Logger logger = LoggerFactory.getLogger(CrossQueryAspect.class);

	@Resource
	private CommonDbEnhancedMapper commonDbEnhancedMapper;

	@AfterReturning(value = "@annotation(crossQuery)", returning = "value")
	public void doAfterReturning(JoinPoint joinPoint, CrossQuery crossQuery, Object value) {
		logger.info("<=== start execute cross query, method {} ====> ", joinPoint.getSignature().getName());
		if (value == null) {
			logger.info("return value is null");
			return;
		}

		MethodSignature signature = (MethodSignature) joinPoint.getSignature();
		logger.info("Signature Return Type: {}", signature.getReturnType());

		List<Object> list = new ArrayList<>();
		if (value instanceof BaseDomain || value.getClass().isArray()) {
			list.add(value);
		} else if (value instanceof List<?>) {
			list.addAll((Collection<?>) value);
		}

		if (CollectionUtils.isEmpty(list)) {
			logger.info("return value is empty");
			return;
		}

		Class<?> returnClazz = list.get(0).getClass();
		Field[] declaredFields = returnClazz.getDeclaredFields();

		for (Field declaredField : declaredFields) {
			declaredField.setAccessible(true);
			CrossQueryField crossQueryField = declaredField.getDeclaredAnnotation(CrossQueryField.class);
			CrossQueryEntity crossQueryEntity = declaredField.getDeclaredAnnotation(CrossQueryEntity.class);
			if (crossQueryField != null) {
				processCrossQuery(crossQueryField, returnClazz, list);
			}
			if (crossQueryEntity != null) {
				processCrossQuery(crossQueryEntity, returnClazz, list);
			}
		}
	}

	private void processCrossQuery(CrossQueryEntity queryEntity, Class<?> returnClazz, List<Object> values) {
    String keyFieldName = queryEntity.keyField();
		String entityFieldName = queryEntity.valueField();
		String tableName = queryEntity.tableName();

		Field keyField = ReflectUtils.getField(returnClazz, keyFieldName);
		Field entityField = ReflectUtils.getField(returnClazz, entityFieldName);
		keyField.setAccessible(true);
		entityField.setAccessible(true);

		Class<?> entityFieldType = entityField.getType();

		Map<Object, JSONObject> map = commonDbEnhancedMapper.selectMap(values, tableName, keyFieldName);
		for (Object value : values) {
			Object key = ReflectionUtils.getField(keyField, value);
			JSONObject jsonObject = map.get(key);
			Object targetEntity = JSON.parseObject(jsonObject.toJSONString(), entityFieldType, JSONReader.Feature.SupportSmartMatch);
			ReflectionUtils.setField(entityField, value, targetEntity);
		}

	}

	private void processCrossQuery(CrossQueryField queryField, Class<?> clazz, List<Object> values) {

		String keyFieldName = queryField.keyField();
		String valueFieldName = queryField.valueField();
		String tableName = queryField.tableName();

		if (StringUtils.hasLength(queryField.tableKeyField()))
			keyFieldName = queryField.tableKeyField();
		if (StringUtils.hasLength(queryField.tableValueField()))
			valueFieldName = queryField.tableValueField();

		Field keyField = ReflectUtils.getField(clazz, queryField.keyField());
		Field valueField = ReflectUtils.getField(clazz, queryField.valueField());
		keyField.setAccessible(true);
		valueField.setAccessible(true);

		Map<Object, JSONObject> map = commonDbEnhancedMapper.selectListUseKeyValue(values, tableName, keyFieldName, valueFieldName);

		for (Object object: values) {
			Object key = ReflectionUtils.getField(keyField, object);
			JSONObject jsonObject = map.get(key);
			if (jsonObject != null) {
				ReflectionUtils.setField(valueField, object, jsonObject.get("value"));
			}
		}
	}

	private boolean isBaseType(Object value) {
		return value.getClass().getClassLoader() == null;
	}
}

```

# 测试

## 使用`@CrossQuery`

建议将 `@CrossQuery` 放在 Mybatis 的 Mapper 接口方法上，这样在查询完主数据之后，即会进行关联查询，
方便后续的业务逻辑处理。

```java
@Mapper
public interface UsersDao {

    /**
     * 通过ID查询单条数据
     *
     * @param id 主键
     * @return 实例对象
     */
    @CrossQuery
    Users queryById(Long id);

    /**
     * 查询指定行数据
     * @param users 实例对象
     * @return List<Users>
     */
    @Select("select * from users")
    @CrossQuery
    List<Users> queryAll(Users users);
}


  // Controller
  @GetMapping
  public ResponseEntity<List<Users>> queryAll() {
      return ResponseEntity.ok(usersDao.queryAll(null));
  }

  @GetMapping("{id}")
  public ResponseEntity<Users> queryById(@PathVariable("id") Long id) {
      return ResponseEntity.ok(this.usersDao.queryById(id));
  }

```

## 测试结果

1. **queryAll**
   ![](test-results.png)

2. **queryById**
   ![](test-result.png)

# 总结

这篇文章提出了一种使用 AOP（面向切面编程）和 MyBatis 动态 SQL 功能来处理业务应用中跨表查询的解决方案。主要目的是减少处理实体关联时的代码复杂性和重复性。

## 核心组件

- `@CrossQuery` 注解：标记需要跨表数据增强的方法
- `@CrossQueryField` 注解：定义字段级别的跨查询关系
- `@CrossQueryEntity` 注解：定义实体级别的跨查询关系
- AOP 切面：拦截带有 `@CrossQuery` 注解的方法并执行数据增强
- 动态 SQL 提供者：使用 MyBatis 的 `@SelectProvider` 在运行时构建灵活的查询
- 基于反射的处理：自动将相关数据映射到目标实体

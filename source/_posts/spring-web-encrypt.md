---
title: SpringWeb请求通用加密组件
date: 2025-08-22 10:54:44
tags:
  - Spring
  - 加密
description: 使用注解对Web请求进行统一加解密处理
categories:
  - 业务增强
---

# 简要介绍

该组件是为了对 `Web` 请求进行统一加解密处理而创建的，在业务场景中，我们往往需要对一些敏感业务数据进行加密处理，比如手机号，身份证号等等，该组件通过自定义参数解析器、增强 `Jackson` 序列化和反序列化过程来实现对 `Web` 请求参数的加解密处理。

{% note simple info %}
通过这种方式可以实现前端无感的加解密处理
{% endnote %}

# 原理简介

`spring-web` 模块中包含了一系列的 `HttpMessageConverter` 接口,这些接口通过 `InputStream` 和 `OutputStream` 来读写 `Http` 请求的 `Body`

框架提供了具体的实现给主要的媒体类型，比如 `application/json`，Spring 应用程序作为客户端（请求发送方）时，这些接口会注册到 `RestClient` 和 `RestTemplate` 中,作为服务端（请求接收方）时，注册到 `RequestMappingHandlerAdapter`。

在 `SpringMVC` 中，`JSON` 数据是通过 `MappingJackson2HttpMessageConverter` 中的 `ObjectMapper` 来进行序列化和反序列化的

可以查看官方文档: [SpringDocs](https://docs.spring.io/spring-framework/reference/web/webmvc/message-converters.html)

{% note simple default %}

**MappingJackson2HttpMessageConverter**

An `HttpMessageConverter` implementation that can read and write JSON by using Jackson’s `ObjectMapper`. You can **`customize`** JSON mapping as needed through the use of Jackson’s provided annotations. When you need further control (for cases where custom JSON serializers/deserializers need to be provided for specific types), you can inject a custom `ObjectMapper` through the `ObjectMapper` property. By default, this converter supports `application/json`. This requires the com.fasterxml.jackson.core:jackson-databind dependency.

{% endnote %}

如上所述，对于大部分 `JSON` 格式的数据，也即是 `Http Body` 携带的数据，可自定义 `ObjectMapper` 对一些字段序列化/反序列化的方式来实现加/解密处理了

至于其他非 `Body` 的数据，如 `RequestParam` 参数，在后面会介绍

# 代码实现

在编写核心代码之前，先定义一个 `@Encrypt` 注解，用于标识需要加密的字段，之后所有的核心代码都需要这个注解。

```java

@JacksonAnnotation
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.PARAMETER})
public @interface Encrypt {
	/**
	 * 密钥
	 */
	String value() default "";
}

```

## HTTP Body

{% tabs  httpBody %}

<!-- tab 配置 -->

这里通过实现 `BeanPostProcessor` 接口中的 `postProcessAfterInitialization` 方式，在 `Bean` 初始化之后，再增强需要的 `Bean`

```java
public class WebBeanPostProcessor implements BeanPostProcessor, PriorityOrdered {
	@Override
	public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        // 创建加密模块
        CryptoModule cryptoModule =
                        new CryptoModule(new EncryptBeanSerializerModifier(), new EncryptBeanDeserializerModifier());
        // ObjectMapper 注册加密模块
        if (bean instanceof ObjectMapper objectMapper) {
            logger.info("ObjectMapper registering cryptoModule");
            objectMapper.registerModule(cryptoModule);
        } else if (bean instanceof RequestMappingHandlerAdapter adapter) {
            List<HttpMessageConverter<?>> converters = adapter.getMessageConverters();
            for (HttpMessageConverter<?> converter : converters) {
                if (converter instanceof MappingJackson2HttpMessageConverter messageConverter) {
                    // 获取 MappingJackson2HttpMessageConverter 中的ObjectMapper，并注册加密模块
                    ObjectMapper objectMapper = messageConverter.getObjectMapper();
                    objectMapper.registerModule(cryptoModule);
                    logger.info("MappingJackson2HttpMessageConverter's ObjectMapper registering cryptoModule");
                }
            }
		}
		return BeanPostProcessor.super.postProcessAfterInitialization(bean, beanName);
	}

	@Override
	public int getOrder() {
		return Integer.MIN_VALUE;
	}
}


```

<!-- endtab -->

<!-- tab Jackson -->

**ObjectMapper**

`ObjectMapper` 的 `readValue` 和 `writeValue` 两个方法可以完成 `JSON` 字符串和对象的转换，同时 `ObjectMapper` 通过可插拔的 `Module` 来灵活的定制序列化/反序列的操作。

**CryptoModule**
继承抽象类 `Module` 来实现 `setupModule(SetupContext setupContext)`, `setupContext` 可以添加序列化器

**Serializer & BeanSerializerModifier**

BeanSerializerModifier 可以在 Jackson 创建 Serializer 的生命周期中修改序列化器

{% note simple info %}

这里不直接添加 Serializer 是为了通过 BeanSerializerModifier 提供的上下文信息来准确的替换 `@Encrypt` 标记过的字段，也可以在 Serializer 中实现 ContextualSerializer 来获取上下文。

{% endnote %}

这里给出 `Serializer` 的代码，`Deserializer` 反序列器同理，只是 `BeanDeserializerModifier` 使用的是 `updateBuilder`。

```java

public class EncryptJsonSerializer extends JsonSerializer<Object> {
	private static final Logger logger = LoggerFactory.getLogger(EncryptJsonSerializer.class);
	private final Encrypt encrypt;

	public EncryptJsonSerializer(Encrypt encrypt) {
		this.encrypt = encrypt;
	}

	@Override
	public void serialize(Object object, JsonGenerator jsonGenerator, SerializerProvider serializerProvider) throws IOException {
		if (object == null) {
			return;
		}
        jsonGenerator.writeString(EncryptUtils.encrypt(object, encrypt));
	}
}

public class EncryptBeanSerializerModifier extends BeanSerializerModifier {

    private static final Logger logger = LoggerFactory.getLogger(EncryptBeanSerializerModifier.class);

    @Override
    public List<BeanPropertyWriter> changeProperties(SerializationConfig config, BeanDescription beanDesc,
                    List<BeanPropertyWriter> beanProperties) {
        for (BeanPropertyWriter writer : beanProperties) {
            if (writer.getAnnotation(Encrypt.class) != null) {
                writer.assignSerializer(new EncryptJsonSerializer(writer.getAnnotation(Encrypt.class)));
            }
        }
        return beanProperties;
    }
}


```

<!-- endtab -->

{% endtabs %}

## HTTP requestParams

在 SpringMVC 调用 @Controller / @RestController 时，会在 HandlerMethodArgumentResolver 接口的一系列实现类中找到支持的解析器，再交由支持的解析器解析参数。

HandlerMethodArgumentResolver 接口主要有两个方法, 和一些实现类，这些实现类又是抽象类。

[详细文档](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/method/support/HandlerMethodArgumentResolver.html)

![alt text](handle-resolvers.png)

在 `SpringMVC` 中大概有 30 多个具体实现类，这里只继承增强两个即可，分别是 `RequestParamMethodArgumentResolver`、`PathVariableMethodArgumentResolver`，还是一个需要自己实现一个 `HandlerMethodArgumentResolver`来解析 `@ModelAttribute`

这里只给出核心 `resolveName`

```java
    @Override
    protected Object resolveName(@NonNull String name, @NonNull MethodParameter parameter,
                    @NonNull NativeWebRequest request) throws Exception {
        Object result = super.resolveName(name, parameter, request);
        Encrypt encrypt = parameter.getParameterAnnotation(Encrypt.class);
        Class<?> targetType = parameter.getParameterType();

        if (encrypt == null || result == null) {
            return result;
        }

        return EncryptUtils.decrypt(result, encrypt, targetType);
    }
```

{% note simple warning  %}

`@ModelAttribute` 注解就是将请求中 `parameters` 解析到实体类中的注解，不添加注解时并且接收参数是非基本类型时默认使用 `@ModelAttribute`

所以在实现 `supportsParameter` 方法时要注意，不仅要实现 `ModelAttributeMethodProcessor`中的逻辑，而且还要添加上 `@Encrypt`的判断，并且要添加到 `ServletModelAttributeMethodProcessor` 的前面，防止接收加密后的字符串后类型转换错误。

{% endnote %}

```java
public class EncryptModelAttributeResolver implements HandlerMethodArgumentResolver {

    private final boolean annotationNotRequired;

    public EncryptModelAttributeResolver(boolean annotationNotRequired) {
        this.annotationNotRequired = annotationNotRequired;
    }

    public boolean supportsParameter(MethodParameter parameter) {
        return (parameter.hasParameterAnnotation(ModelAttribute.class)
                        || this.annotationNotRequired && !BeanUtils.isSimpleProperty(parameter.getParameterType()))
                        && parameter.hasMethodAnnotation(Encrypt.class);
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                    NativeWebRequest webRequest, WebDataBinderFactory binderFactory) throws Exception {
        Class<?> paramType = parameter.getParameterType();
        Encrypt encrypt = parameter.getParameterAnnotation(Encrypt.class);
        // 1. 如果是 String 或基本类型，直接从请求参数取值并解密
        if (String.class.isAssignableFrom(paramType)) {
            String value = webRequest.getParameter(parameter.getParameterName());
            if (value != null) {
                return EncryptUtils.decrypt(value, encrypt);
            }
            return null;
        }

        // 2. 如果是数组或集合
        if (paramType.isArray()) {
            String[] values = webRequest.getParameterValues(parameter.getParameterName());
            if (values != null) {
                for (int i = 0; i < values.length; i++) {
                    values[i] = EncryptUtils.decrypt(values[i], encrypt);
                }
            }
            return values;
        }

        if (List.class.isAssignableFrom(paramType)) {
            String[] values = webRequest.getParameterValues(parameter.getParameterName());
            List<String> list = new ArrayList<>();
            if (values != null) {
                for (String val : values) {
                    list.add(EncryptUtils.decrypt(val, encrypt));
                }
            }
            return list;
        }

        // 3. POJO 对象：先实例化，再绑定参数并解密字段
        Object attribute = paramType.getDeclaredConstructor().newInstance();
        Field[] fields = paramType.getDeclaredFields();
        for (Field field : fields) {
            Encrypt fieldEncrypt = field.getAnnotation(Encrypt.class);
            field.setAccessible(true);
            String fieldName = field.getName();
            Class<?> fieldType = field.getType();
            String[] paramValues = webRequest.getParameterValues(fieldName);
            if (paramValues == null || paramValues.length == 0) {
                continue;
            }
            if (fieldEncrypt == null) {
                basicProcess(field, attribute, fieldType, paramValues);
            } else {
                decryptProcess(field, attribute, fieldEncrypt, fieldType, paramValues);
            }
        }
        return attribute;
    }

    private void basicProcess(Field field, Object attribute, Class<?> fieldType, String[] paramValues)
                    throws IllegalAccessException {
        if (ConvertUtils.isBasicType(fieldType)) {
            field.set(attribute, ConvertUtils.convertToTargetType(paramValues[0], fieldType));
        } else if (field.getType().isArray()) {
            field.set(attribute, ConvertUtils.convertArrayToTargetType(paramValues, fieldType));
        } else if (List.class.isAssignableFrom(fieldType)) {
            List<Object> list = new ArrayList<>();
            for (String val : paramValues) {
                list.add(ConvertUtils.convertToTargetType(val, fieldType));
            }
            field.set(attribute, list);
        }
    }

    private void decryptProcess(Field field, Object attribute, Encrypt fieldEncrypt, Class<?> fieldType,
                    String[] paramValues) throws IllegalAccessException {
        if (ConvertUtils.isBasicType(fieldType)) {
            field.set(attribute, EncryptUtils.decrypt(paramValues[0], fieldEncrypt, fieldType));
        } else if (field.getType().isArray()) {
            Object[] objects = new Object[paramValues.length];
            for (int i = 0; i < paramValues.length; i++) {
                objects[i] = EncryptUtils.decrypt(paramValues[i], fieldEncrypt, fieldType);
            }
            field.set(attribute, objects);
        } else if (List.class.isAssignableFrom(field.getType())) {
            List<Object> list = new ArrayList<>();
            for (String val : paramValues) {
                list.add(EncryptUtils.decrypt(val, fieldEncrypt, fieldType));
            }
            field.set(attribute, list);
        }
    }
}

```

{% note warning simple %}
注意注入的顺序，否则可能不生效，而且产生类型转换异常

**_tips_**
`SpringMVC` 源码中，包路径`org.springframework.web.method.support`的 `HandlerMethodArgumentResolverComposite` 管理了 `HandlerMethodArgumentResolver` 所有实现类，可以通过 Debug 的方式，查看请求调用了具体哪个 `Resolver`

{% endnote %}

```java

public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        CryptoModule cryptoModule =
                        new CryptoModule(new EncryptBeanSerializerModifier(), new EncryptBeanDeserializerModifier());
        if (bean instanceof RequestMappingHandlerAdapter adapter) {
            List<HandlerMethodArgumentResolver> resolvers = adapter.getArgumentResolvers();
            List<HandlerMethodArgumentResolver> newResolvers = new ArrayList<>(resolvers.size());
            for (HandlerMethodArgumentResolver resolver : resolvers) {
                if (resolver instanceof RequestParamMethodArgumentResolver) {
                    newResolvers.add(new EncryptRequestParamResolver(false));
                } else if (resolver instanceof PathVariableMethodArgumentResolver) {
                    newResolvers.add(new EncryptPathVariableResolver());
                    newResolvers.add(new EncryptModelAttributeResolver(true));
                } else {
                    newResolvers.add(resolver);
                }
            }
            adapter.setArgumentResolvers(newResolvers);
		}
		return BeanPostProcessor.super.postProcessAfterInitialization(bean, beanName);
	}

```

# 使用方式

```java
// 1. entity
public class Users implements Serializable {
    private static final long serialVersionUID = 438491303269108393L;
    @Encrypt
    private Long id;

    private String username;
    // ...
}

// 2. Controller
// 2.1 PathVariable
@GetMapping("/{id}")
public ResponseEntity<Users> queryById(@PathVariable("id") @Encrypt Long id) {
    return ResponseEntity.ok(this.usersDao.queryById(id));
}
// 2.2 ModelAttribute
@GetMapping
public ResponseEntity<List<Users>> queryAll(@Encrypt Users users) {
    return ResponseEntity.ok(usersDao.queryAll(null));
}
// 2.3 RequestParam
@GetMapping
public ResponseEntity<List<Users>> queryAll(@RequestParam @Encrypt String phone) {
    return ResponseEntity.ok(usersDao.queryAll(null));
}
```

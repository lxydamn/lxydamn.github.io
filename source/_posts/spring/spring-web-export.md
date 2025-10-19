---
title: Spring通用Excel导出组件
date: 2025-09-13 20:14:17
tags:
  - Spring
  - Excel
categories:
  - spring
---

# 简要介绍

该组件基于 FastExcel, 通过几个关键的注解即可将数据导出为 Excel 或 Csv 等格式的文件。只需要专注地处理数据返回部分，减轻了开发人员对 Excel、流和响应处理的负担。
FastExcel 是 EasyExcel 的一个续作，由原 EasyExcel 作者开发，在功能完全兼容 EasyExcel 的原有功能特性。

## 功能特性

1. 使用注解创建导出功能
2. 支持同步和异步导出
3. 基于 EasyExcel，不会造成内存溢出问题

## 基本使用方法

1. 为导出接口的 Controller 方法添加 @Export 注解
2. 为导出的实体类添加 @ExportEntity 注解
3. 需要导出的实体类字段添加 @ExportColumn 注解
4. 正常调用接口即可完成导出

```java
# 1. Controller层注解
  @GetMapping("/export")
  @Export(value = Users.class, method = ExportMethod.ASYNC)
  public ResponseEntity<List<Users>> export() {
      return ResponseEntity.ok(usersDao.queryAll(null));
  }
# 2. 实体类注解
@EqualsAndHashCode(callSuper = true)
@Data
@ExportEntity(name = "用户导出表")
public class Users extends BaseDomain implements Serializable {
    private static final long serialVersionUID = 438491303269108393L;
    @Encrypt
    @ExportColumn(name = "用户ID")
    private Long id;
    @ExportColumn(name = "用户名")
    private String username;
    @Encrypt
    private String password;
    @ExportColumn(name = "角色")
    private String role;
    @ExportColumn(name = "昵称")
    private String nickname;
    @ExportColumn(name = "角色名称")
    private String roleName;
}
```

# 基本设计与实现

在使用 FastExcel 的基础上，不使用注解的导出过程基本上是：

1. 获取导出数据
2. 获取 HttpResponse 的流对象
3. 修改 HttpResponse 的响应头
4. 通过 FastExcel 将数据写入流中
5. 返回响应

在此基础上，可以利用 AOP 和反射对 2、3、4 步进行改造，采用声明式的方式来完成 Excel 文件导出功能

## 详细计划

1. 导出方式的判断
   在导出之前，需要知道代码声明的导出方式是同步还是异步

- 同步导出：直接执行获取数据的方法，取得数据后进行后续步骤
- 异步导出：创建一个任务 ID，直接返回给前端，后续通过任务 ID，下载导出文件，将获取数据的方法另开一个线程，将数据写入到服务器文件系统中，完成后通知任务完成。

2. 写入数据的时机
   考虑到存在其他的切面和序列化可能会对数据进行处理，使用@ControllerAdvice 注解，直接在数据写入 Body 前进行拦截，再由导出组件在进行序列化的过程。

   {% note info simple %}
   使用 ObjectMapper.writeValueAsString() 方法进行序列化，在序列化之后，再获取@ExportColumn 中的字段名，通过字段名再将 JSON 化后的数据再读取出来写入流中。
   {% endnote %}

3. 异步同步的处理
   对于同步的方法来说，只需要获取线程上下文中的 HttpResponse 对象进行处理一次即可。
   对于异步方法来说，需要先对 HttpResponse 写入异步任务 Id，在获取数据线程执行完获取数据的之后，新建文件，再通过 IO 来讲数据写入文件中。

## 实现思路

基于上述的思路，基本上只涉及 AOP、反射、线程池和 IO 的一些简单操作，实现过程并不复杂。

{% note info simple %}
Github: [https://github.com/lxydamn/zeon/tree/master/zeon-export](https://github.com/lxydamn/zeon/tree/master/zeon-export)
{% endnote %}

# 拓展

1. 通用数据分批导出实现
2. 同一接口导出不同列数据
3. 用户接口自选择数据列导出

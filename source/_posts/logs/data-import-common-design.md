---
title: 常规数据导入方案总结
description: 常规数据导入方案总结
date: 2025-10-26 10:32:00
tags:
  - 导入
categories:
  - logs
---

# 前言

在绝大多数信息系统中，大量的业务数据不可能人工的输入，因此，系统必须具备一个数据导入的功能，使得用户能够节省手动维护这些数据的过程。除此之外，企业中多个信息的数据同步大部分情况下也是数据导入的范畴。

本篇博客记录了作者在实现数据导入功能时的一些总结。

# Excel 模板导入数据

Excel 模板导入是比较常见的一种数据导入方式，定义数据导入模板，让用户下载导入模板并填充数据，系统对数据校验、处理、保存等操作。基于 Excel 的导入/导出有着很丰富的第三方库，如：Apache POI、Java Excel（JXL）、EasyExcel、FastExcel 等。

| 库名                  | 特点                                                         |
| --------------------- | ------------------------------------------------------------ |
| **Apache POI**        | 功能强大，但 `.xls` / `.xlsx` 都会一次性加载到内存，容易 OOM |
| **JXL**               | 已停止维护，仅支持 `.xls`                                    |
| **EasyExcel（推荐）** | 阿里开源，支持流式读取，不易 OOM                             |

需要注意的是，POI 的 .xls(HSSF) 和 .xlsx(XSSF) 的模型都是一次性的加载整个 excel 文件，不论你的服务器内存有多大，只要 excel 文件过大，就有可能出现 OOM 的问题。如果使用 POI 则需要考虑自己实现流式读取，获取使用已经解决了 OOM 问题的 EasyExcel 库。

## 导入模板定义

要让用户可以下载数据导入模板，服务器需要定义模板文件，在用户需要时，提供下载模板。

模板定义有三种常见方式：

1. 静态模板：手动创建 Excel 模板文件，放在资源目录中直接下载；

2. 动态模板：模板结构（表头、样例数据）由数据库或配置表定义，系统运行时动态生成；

3. 缓存模板：首次生成模板后保存至服务器，下次直接返回文件路径，避免重复生成。

示例 —— 使用 EasyExcel 动态生成模板并写入 HttpResponse：

```java
public void template(HttpServletResponse response) {

  response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''user-import-template.xlsx" );

  try (ServletOutputStream outputStream = response.getOutputStream();
      ExcelWriter writer = EasyExcel.write(outputStream).build()){
    for (int i = 0; i < 3; i ++) {
      WriteSheet sheet = EasyExcel.writerSheet().build();
      sheet.setSheetName("sheet" + i);
      sheet.setSheetNo( i);
      sheet.setHead(List.of(List.of("姓名"), List.of("手机号"), List.of("邮箱")));
      writer.write(List.of(List.of("张三-" + i, "12345678901-" + i , "123@qq.com-" + i)), sheet);
    }
  } catch (Exception  e) {
    log.info("template error: {}", e.getMessage());
  }

}
```

更进一步的优化是通过注解定义模板字段，比如：

```java
@ExcelModel(name = "用户导入模板")
public class UserImportDTO {
    @ExcelProperty("姓名")
    private String name;
    @ExcelProperty("手机号")
    private String phone;
    @ExcelProperty("邮箱")
    private String email;
}
```

系统可通过反射自动生成模板文件，从而在统一接口下支持多种导入模板类型。

## 数据导入处理

导入的核心步骤通常为：

1. 读取文件 → 使用 EasyExcel 读取用户上传的 Excel；

2. 校验数据 → 校验数据格式、唯一性、业务逻辑；

3. 处理数据 → 将数据落地入库、调用下游接口或异步处理。

为了统一处理逻辑，可以设计一个通用的数据接口表（Data Import Interface Table）。

| 字段                      | 说明                                      |
| ------------------------- | ----------------------------------------- |
| batch_no                  | 导入批次号（全局唯一）                    |
| template_code             | 导入模板标识（区分不同导入类型）          |
| status                    | 数据状态：`PENDING` / `SUCCESS` / `ERROR` |
| error_message             | 错误信息（可精确到行）                    |
| create_time / update_time | 处理时间                                  |
| data                      | 原始数据（JSON 或 TEXT）                  |

在数据校验和数据处理过程中，出现异常信息则把异常信息更新到数据接口表，处理完成更新数据处理状态。

easyExcel 读取 excel 文件并将数据存入数据接口表

```java

public String importExcel(@RequestParam("file") MultipartFile file) {
  try (InputStream is = file.getInputStream()) {
    String batchNo = "USER-" + UUID.randomUUID().toString().replace("-", "");
    log.info("start import excel, batchNo: {}", batchNo);
    List<DataImportItf> columns = new ArrayList<>();
    EasyExcel.read(is, new AnalysisEventListener<Map<String, String>>() {
      @Override
      public void invoke(Map<String, String> list, AnalysisContext context) {
        Integer sheetNo = context.readSheetHolder().getSheetNo();
        List<String> results = list.values().stream().toList();
        columns.add(DataImportItf.builder()
            .batchNo(batchNo)
            .status("PENDING")
            .sheetNo(Long.valueOf(sheetNo))
            .data(results.toString())
            .build());
        if (columns.size() > 100) {
          dataImportItfMapper.insert(columns);
          columns.clear();
        }
      }
      @Override
      public void doAfterAllAnalysed(AnalysisContext analysisContext) {
        log.info("read all of data sheet: {}", analysisContext.readSheetHolder().getSheetName());
      }
    }).doReadAll();

    return batchNo;
  } catch (IOException e) {
    throw new RuntimeException(e);
  }
}

```

优点：

- 支持多 Sheet 自动读取；

- 采用流式解析，几乎不占内存；

- 每 100 条数据分批插入数据库；

- 可与“批次号机制”结合，实现异步校验与处理。

# 接口导入数据

## 常见场景

Excel 模板导入适用于用户主动上传数据的场景，而接口导入更适合系统与系统之间的自动同步。
例如：从 ERP、CRM、主数据系统或第三方平台中批量同步业务数据（客户信息、供应商资料、物料主数据等）。

接口导入的本质依然是“数据落地 + 状态流转”，与 Excel 导入的区别仅在于数据来源不同。

## 通用设计

接口导入可参考以下标准流程：

1. 接收数据：通过接口接收外部系统推送的数据；

2. 生成导入批次：为每次导入生成全局唯一的 batch_no；

3. 保存数据到接口表：将原始数据、批次号、模板标识、状态（PENDING）写入数据接口表；

- 异步处理任务：

- 校验数据格式与业务逻辑；

- 将有效数据入库；

- 更新数据接口表状态；

- 记录错误信息（可精确到行或记录 ID）；

4. 结果反馈：返回批次号供后续查询处理状态。

# 总结

数据导入功能看似简单，但要做到稳定、可追踪、易拓展，还需要做好一些关键点：

| 关键点       | 最佳实践                                                       |
| ------------ | -------------------------------------------------------------- |
| **性能优化** | 流式解析,防止 OOM；分批入库（100~500 条 / 次）；数据库批量插入 |
| **错误定位** | 每条记录保存错误信息，支持重导失败数据                         |
| **可追踪性** | 批次号贯穿导入全流程；提供批次状态查询接口                     |
| **异步处理** | 使用线程池、MQ 或任务调度异步执行导入逻辑                      |
| **模板复用** | 通过模板编码或注解机制实现统一的模板管理                       |

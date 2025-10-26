---
title: Java-BigDecimal
description: 在 Java 中使用 BigDecimal 类处理高精度计算
date: 2025-10-19 20:47:26
tags:
  - Java
categories:
  - algorithm
---

# 前言

在大多数高级程序语言中，浮点数通常不能被精确的表示，这与计算机保存小数的机制有关系，计算机的位数有限，保存超过位数的小数时，就会发生截断。
在金融系统或统计系统中，有非常多高精度的计算需求，这时候使用原生的 float 或 double 类型就会有精度丢失的风险。
为了解决这个问题，Java 提供了 BigDecimal 类。BigDecimal 可以处理任意精度的十进制数，保证计算结果的准确性。

# 基本概念

BigDecimal 类是 Java math 包中的一个类，用于处理高精度的十进制数。它由两部分组成：一个任意精度的整数非标度值（unscaled value）和一个 32 位的整数标度（scale）。这个任意精度的整数使用的是 BigInteger 类，主要使用 int[] 数组来实现大整数，BigDecimal 则在此基础上，加入了对精度的控制。

BigDecimal 和 String 类似，BigDecimal 也是一个不可变对象，一旦创建，它的值就无法改变。任何的运算结果，都是一个新的 BigDecimal 对象。

所以大量使用 BigDecimal 进行复杂计算的场景，其效率会比原生的 float 和 double 类型低很多。

# 基本使用

## 构造

在使用 BigDecimal 类时，推荐使用它的 BigDecimal(String val)构造方法，使用 float 和 double 构造方法，可能会丢失精度。

## 运算

BigDecimal 类提供了丰富的运算方法，如 add、subtract、multiply、divide 等，这些方法都返回一个新的 BigDecimal 对象，而不是修改当前对象。

值得注意的是，在做除法运算 devide 时，最好提供 scale 和 roundingMode 否则很可能会遇到 ArithmeticException（无法除尽出现无限循环小数的时候），其中 scale 表示要保留几位小数，roundingMode 代表保留规则。

```java

public BigDecimal divide(BigDecimal divisor, int scale, RoundingMode roundingMode) {
    return divide(divisor, scale, roundingMode.oldMode);
}

```

## 舍入模式

在指定位数时，往往需要指定舍入模式，例如，四舍五入、截断、向上取整、向下取整等等。BigDecimal 类提供了很多舍入模式，以下是常见的舍入模式：

以下示例均保留两位小数

1. RoundingMode.UP：向远离零的方向舍入，1.2345 -> 1.24。
2. RoundingMode.DOWN：向零的方向舍入，1.2345 -> 1.23。
3. RoundingMode.CEILING：向正无穷方向舍入，1.2345 -> 1.23。
4. RoundingMode.FLOOR：向零的方向舍入，1.2345 -> 1.23。
5. RoundingMode.HALF_UP: 四舍五入。，1.235 -> 1.24。
6. RoundingMode.HALF_DOWN：五舍六入，1.235 -> 1.23。
7. RoundingMode.HALF_EVEN：银行家舍入法，1.2345 -> 1.23。
8. RoundingMode.UNNECESSARY: 用于确保不进行舍入。如果运算结果有多余的小数位，将抛出 ArithmeticException

{% note simple info %}

**银行家舍入法**

银行家舍入法也叫四舍六入五取偶，是由 IEEE 754 标准推荐的浮点数取整算法，主要用于减少累计误差并维持数据统计特性

其规则包含三种情况：当修约位后数字小于 5 时舍去，大于 5 时进位；若等于 5 且后无有效数字，则按修约位前数字奇偶性决定舍入——奇数进位，偶数舍去；若 5 后存在非零数字则直接进位。例如，9.825 保留两位小数得 9.82（修约位前为偶数），9.835 则为 9.84（修约位前为奇数）

{% endnote %}

## 大小比较

BigDecimal 使用 compareTo 方法进行大小比较，返回结果为 0 表示相等，小于 0 表示小于，大于 0 表示大于。

# BigDecimal 等值比较问题

在使用 BigDecimal 进行等值比较时，equals 方法和 compareTo 方法的逻辑是不同的，基本概念中提到过，BigDecimal 由两部分组成，所以在使用 equals 时，会比较数值和精度，而 compareTo 方法则只会比较数值。

```java

@Override
public boolean equals(Object x) {
    if (!(x instanceof BigDecimal xDec))
        return false;
    if (x == this)
        return true;
    // 比较精度
    if (scale != xDec.scale)
        return false;
    // 判断数值大小，查看是否可以使用原生基本类型，
    long s = this.intCompact;
    long xs = xDec.intCompact;
    if (s != INFLATED) {
        if (xs == INFLATED)
            xs = compactValFor(xDec.intVal);
        return xs == s;
    } else if (xs != INFLATED)
        return xs == compactValFor(this.intVal);
    // 数值比较，数组循环一一比较
    return this.inflated().equals(xDec.inflated());
}

// 直接按数位，循环一一比较
public int compareTo(BigInteger val) {
    if (signum == val.signum) {
        return switch (signum) {
            case 1  -> compareMagnitude(val);
            case -1 -> val.compareMagnitude(this);
            default -> 0;
        };
    }
    return signum > val.signum ? 1 : -1;
}

final int compareMagnitude(BigInteger val) {
    int[] m1 = mag;
    int len1 = m1.length;
    int[] m2 = val.mag;
    int len2 = m2.length;
    if (len1 < len2)
        return -1;
    if (len1 > len2)
        return 1;
    for (int i = 0; i < len1; i++) {
        int a = m1[i];
        int b = m2[i];
        if (a != b)
            return ((a & LONG_MASK) < (b & LONG_MASK)) ? -1 : 1;
    }
    return 0;
}

```

# 更准确的计算

尽管使用 BigDecimal 了，但是大部分涉及到乘除法的运算都不能完全的保证精度。

例如, 有一组数据, 要按照这个数值占这组数据总和的权重来分配一个数值 4.59

21.90,18.90,16.90,17.70,21.90,21.80,15.43,22.90

```java
public static void main(String[] args) {
  List<String> list = Arrays.asList("21.90", "18.93", "16.97", "17.71", "21.92", "21.80", "15.43",
      "22.90");
  BigDecimal taxAmount = new BigDecimal("4.59");
  List<BigDecimal> amounts = list.stream().map(BigDecimal::new).toList();
  BigDecimal total = amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
  List<BigDecimal> results = new ArrayList<>();
  for (BigDecimal amount : amounts) {
    results.add(amount
        .divide(total, 2, RoundingMode.HALF_DOWN)
        .multiply(taxAmount)
        .setScale(2, RoundingMode.HALF_DOWN));
  }

  System.out.println( results.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
}
```

按两位计算，结果为 4.62
按四位计算，结果为 4.5896
按六位计算，结果为 4.590004
按八位计算，结果为 4.59000000

{% note simple info %}

**小结**

为了确保计算结果准确，在进行计算时，使用位数最好高于预期结果位数 4 位以上，计算全过程统一计算的位数和舍入模式。

{% endnote%}

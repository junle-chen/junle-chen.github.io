---
layout: post
title: PyTorch Layer and Tensor Notes
tags:
  - pytorch
  - note
mathjax: true
---

### nn.linear
w = nn.linear(4,2)
w.weight.shape (2,4)

### nn.embedding
常用参数：  
  **① num_embeddings (int)：** 词典中词的总数
  **② embedding_dim (int)：** 词典中每个词的嵌入维度
  **③ padding_idx (int, optional)：** 填充索引
![](assets/Pasted%20image%2020250513165818.png)

nn.conv1d
- in_channels(`int`) – 输入信号的通道。在文本分类中，即为词向量的维度
- out_channels(`int`) – 卷积产生的通道。有多少个out_channels，就需要多少个1维卷积
- kernel_size(`int` or `tuple`) - 卷积核的尺寸，卷积核的大小为(k,)，第二个维度是由in_channels来决定的，所以实际上卷积大小为kernel_size*in_channels
- stride(`int` or `tuple`, `optional`) - 卷积步长
- padding (`int` or `tuple`, `optional`)- 输入的每一条边补充0的层数
- dilation(`int` or `tuple`, `optional``) – 卷积核元素之间的间距
- groups(`int`, `optional`) – 从输入通道到输出通道的阻塞连接数
- bias(`bool`, `optional`) - 如果`bias=True`，添加偏置
例子
这里32为batch_size，35为句子最大长度，256为词向量

再输入一维卷积的时候，需要将(32,35,256)变换为(32,256,35)，因为一维卷积是在最后维度上扫的，最后out的大小即为：32\*256\*（35-2+1）=32\*256\*34
![](assets/Pasted%20image%2020250513170025.png)
### torch.split
`torch.split()` 是 PyTorch 中用于将一个张量 (tensor) 分割成多个较小张量的函数。它的基本语法如下：

`torch.split(tensor, split_size_or_sections, dim=0)`
### **参数**

1. **tensor (Tensor)**：要进行分割的输入张量。
    
2. **split_size_or_sections (int or list)**：
    
    - **int**：如果传入的是一个整数 `split_size`，则按照这个大小在指定维度上等间隔地分割张量，最后一个子张量可能会小于这个大小（如果无法整除）。
        
    - **list or tuple**：如果传入的是一个列表或元组，则按照列表或元组中的每个元素指定的大小进行不等间隔分割。
        
3. **dim (int, default=0)**：指定在哪个维度上进行分割，默认是在第 0 维（batch 维度）。
    

### **返回值**

- 返回一个包含多个张量的元组，每个张量的形状取决于分割方式。

  ### **示例 1：等间隔分割**

python

CopyEdit
```Python
import torch

# 创建一个 2x6 的张量
x = torch.tensor([[1, 2, 3, 4, 5, 6],
                  [7, 8, 9, 10, 11, 12]])

# 在第 1 维 (列) 以每 2 个元素进行分割
parts = torch.split(x, 2, dim=1)
for part in parts:
    print(part)

```

**输出：**
```Python
tensor([[1, 2],
        [7, 8]])
tensor([[3, 4],
        [9, 10]])
tensor([[ 5,  6],
        [11, 12]])
```

- 这里 `dim=1` 表示在列方向进行分割，每个子张量有 2 列。
    

---

### **示例 2：不等间隔分割**

```Python
import torch

# 创建一个 1x10 的张量
x = torch.arange(10).view(1, -1)

# 在第 1 维按照指定大小进行不等分割
parts = torch.split(x, [3, 2, 5], dim=1)
for part in parts:
    print(part)

```

**输出：**

```Python
tensor([[0, 1, 2]])
tensor([[3, 4]])
tensor([[5, 6, 7, 8, 9]])
```
- 这里分割大小 `[3, 2, 5]` 指定了每个子张量的列数。
    

---

### **示例 3：自动处理剩余元素**

如果张量的大小不能被 `split_size` 整除，`torch.split()` 会自动将剩余元素放在最后一个块中。
```Python
import torch

x = torch.arange(8)

# 每 3 个元素进行分割
parts = torch.split(x, 3)
for part in parts:
    print(part)
```

**输出：**

```Python
tensor([0, 1, 2])
tensor([3, 4, 5])
tensor([6, 7])`
```

### torch.squeeze()
#### **基本语法**
`torch.squeeze(input, dim=None) -> Tensor`
#### **参数**

1. **input (Tensor)**：
    
    - 需要进行压缩的输入张量。
        
2. **dim (int, optional)**：
    
    - 如果指定，则只会尝试删除该维度上的大小为 1 的维度。如果该维度的大小不为 1，则形状保持不变。
        
    - 如果不指定，则删除所有大小为 1 的维度。
        

---

#### **返回值**

- 返回一个新的张量，如果没有指定 `dim`，则删除所有大小为 1 的维度。
    
---

### **`squeeze()` 和 `unsqueeze()` 配合使用**

`squeeze()` 常常与 **`unsqueeze()`** 一起使用，**`unsqueeze()`** 是用于**添加**大小为 1 的维度。

```Python
import torch

x = torch.tensor([1, 2, 3, 4])
print("原始形状:", x.shape)

# 增加一个维度
y = x.unsqueeze(0)
print("增加一个维度后:", y.shape)

# 删除刚刚增加的维度
z = y.squeeze()
print("删除增加的维度后:", z.shape)

```

**输出：**

```Python
原始形状: torch.Size([4])
增加一个维度后: torch.Size([1, 4])
删除增加的维度后: torch.Size([4])
```

### torch.chunk()
#### **基本语法**


`torch.chunk(input, chunks, dim=0) -> list of Tensors`

- **input**：要分割的张量
    
- **chunks**：要分割的块数
    
- **dim**：在哪个维度上分割
    

#### **示例**



```Python
import torch

# 创建一个 10x4 张量
x = torch.randn(10, 4)

# 平均分成 2 个块
part1, part2 = torch.chunk(x, 2, dim=0)

print("Part 1:", part1.shape)
print("Part 2:", part2.shape)

```

**输出：**

```Python
Part 1: torch.Size([5, 4])
Part 2: torch.Size([5, 4])
```

- 如果 **第一维度**不能被 **2** 整除，最后一个块会包含剩余的元素。

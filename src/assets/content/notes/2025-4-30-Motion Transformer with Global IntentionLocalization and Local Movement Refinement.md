### 论文核心思想
**目标：** 为自动驾驶系统预测道路参与者（车辆、行人、自行车等）在复杂道路环境下的未来轨迹。
**创新点：** 提出一种新的预测框架 MTR，它结合了：

1. **全局意图定位（Global Intention Localization）**：确定可能的运动模式（如左转、右转、直行等）；
    
2. **局部运动细化（Local Movement Refinement）**：对初步轨迹进行微调，获得更精确的预测。
    

---
### 与以往方法的对比
传统方法分为两类：

- **基于目标点（goal-based）方法**：生成大量候选目标点，评估其概率，然后为每个目标点生成完整轨迹（计算和内存开销大）；
    
- **直接回归（regression-based）方法**：从历史轨迹直接回归多个轨迹（容易过拟合于常见模式、收敛慢）。

**MTR优点：**
- 不依赖密集目标点；
    
- 使用可学习的少量运动查询对（motion query pairs）提高预测多样性；
    
- 利用 Transformer 架构做轨迹优化，结构简洁、性能强大。

###  MTR 框架结构
![](assets/Pasted%20image%2020250430211708.png)
MTR 框架采用 **Transformer 编码器-解码器结构**，用于多模态运动轨迹预测。整体框架可分为三个核心部分：

1. **Transformer 编码器（Scene Context Encoder）**
    
2. **Transformer 解码器 + Motion Query Pair（运动查询对）**
    
3. **密集未来预测模块（Dense Future Prediction）**

#### Transformer 编码器：建模场景上下文
**目标：**
提取出 agent（车辆/行人等）与地图之间的时空上下文关系，用于后续轨迹生成。
**输入：**
- 历史轨迹（agent 的位置信息、角度、速度等）:$A_{\mathrm{in~}}\in\mathbb{R}^{N_a\times t\times C_a}$,$N_{a}$ is the number of agents, t is the number of history frame, $C_{a}$ is the number of state information(like location, heading angle and velocity)
    
- 道路地图（polyline 表示法，线段形式）: $M_{\mathrm{in}}\in\mathbb{R}^{N_m\times n\times C_m}$, $N_{m}$ is the number of map polyline, n is the number of points in each polyline and $C_{m}$ is the number of attributes of each point(like location and road type) 
    
- 所有输入都进行了 agent-centric 归一化（以目标 agent 为坐标中心）

$$A_{\mathfrak{p}}=\phi\left(\mathbf{MLP}(A_{\mathrm{in}})\right),\quad M_{\mathfrak{p}}=\phi\left(\mathbf{MLP}(M_{\mathrm{in}})\right)$$
- $\phi$为maxpool, $\text{agent features }A_{\mathfrak{p}}\in\mathbb{R}^{N_a\times D}\text{ and map features }M_{\mathfrak{p}}\in\mathbb{R}^{N_m\times D}$
#### Scene context encoding with local transformer encoder
使用局部注意力来获得车道之间的关系，节省内存消耗
第j层transformer encoder layer
$$G^j=\text{MultiHeadAttn}\left(\mathrm{query=}G^{j-1}+\mathrm{PE}_{G^{j-1}},\mathrm{~key=}\kappa(G^{j-1})+\mathrm{PE}_{\kappa(G^{j-1})},\mathrm{~value=}\kappa(G^{j-1})\right)$$
$G^0=[A_{\mathfrak{p}},M_{\mathfrak{p}}]\in\mathbb{R}^{(N_a+N_m)\times D}$包含agent和map的特征信息，k为k最近邻，PE为正弦位置编码

- 使用 **Polyline Encoder** 处理轨迹和地图 → 每个 polyline 转换成一个 token 向量；
    
- 使用 **局部注意力 Transformer 编码器**（local self-attention）而非全局注意力，优势：
    
    - 保持空间局部性结构；
        
    - 可扩展性更强，能处理更多地图线段（避免内存爆炸）。
        
#### Dense Future Prediction
- 在自动驾驶场景中，**agent（车辆、行人、自行车等）之间的相互影响**会显著影响其未来轨迹；
- 文章希望实现历史轨迹和未来轨迹的交互
### **输入：**

- 编码器输出的 agent 特征（A_past，由历史轨迹得到）

### **过程：**

1. 使用一个简单的 **三层 MLP 网络**，对每个 agent 的特征进行回归；
    
2. 输出每个时间步的：
    
    - 位置（x, y）
        
    - 速度（vx, vy）
        
公式如下：

$S_{1:T} = \text{MLP}(A_{\text{past}})$

其中 $S_i \in \mathbb{R}^{N_a \times 4}$，表示第 i 帧中每个 agent 的预测状态（位置+速度）。

---
### **结果处理：**

- 将预测出的未来轨迹再用 polyline encoder 编码成特征：
    
    $A_{\text{future}} = \text{PolylineEncoder}(S_{1:T})$
    
- 然后与历史特征拼接，形成增强后的 agent 特征用于主 decoder 使用：
    
    $A = \text{MLP}([\ A_{\text{past}},\ A_{\text{future}}\ ])$


### Transformer Decoder with Motion Query pairs
![515](assets/Pasted%20image%2020250501205651.png)

**Static Intention Query（全局意图定位）**
源：训练集中的轨迹终点做 K-Means 聚类，得到 K 个意图点 $I \in \mathbb{R}^{K \times 2}$
每个点代表一种“**运动模式**”：不仅考虑方向，还考虑速度。
编码方式：$Q_I = \text{MLP}(\text{PE}(I))$
其中 PE 是 Sine Position Encoding，MLP 输出维度为 Transformer decoder 的 hidden dim（如 256）。
**Dynamic Searching Query（局部运动细化）**
初始设置为对应的 static intention point I。
**每层更新方式：**
$Q_S^{j+1} = \text{MLP}(\text{PE}(Y_T^j))$
其中$Y_T^j$ 是第 j 层预测的每条轨迹在最后一帧（时间 T）的位置（终点），表示轨迹“走到哪了”。

  

#### **用途：**

- 在 **Cross-Attention 中作为位置信息**，引导模型关注该位置附近的 agent 和 map 特征；
    
- 实现对运动轨迹的 **迭代细化 refinement**。

#### Step 1: 查询初始化（Query Initialization）

- 初始时，两个 Motion Query：
    
    - **Static Intention Query** I：作为位置编码（Position Embedding）；
        
    - **Dynamic Searching Query**：初始与 I 相同，用于检索局部地图特征；
        
    
- 两者都通过 Sine + MLP 模块编码为 transformer 输入 embedding。
    
#### Step 2: Multi-Head Self-Attention（不同 motion 模式间交流）

- 输入为上一层输出的 query content 特征 $C^j \in \mathbb{R}^{K \times D}$；
    
- 加入 static query embedding$Q = K = V = C^j + \text{PE}(I)$，进行 self-attention；
    
- 输出 $C^j_{sa}$：包含 motion 模式间交互信息；
    
- 再进入 Add & Norm 和 FFN 模块。

为不同motion赋予概率
![](assets/Pasted%20image%2020250501210353.png)
#### Step 3: Multi-Head Cross-Attention（检索场景特征）

- 输入为 C^j_{sa}，查询动态地图特征（从 agent 和地图中提取）；
    
- 查询向量：
    
    - **Query** = $[C^j_{sa}, Q_S^j]$：动态位置 + 内容
        
    - **Key** =$[A, PE_A], [M{\prime}, PE_{M{\prime}}]$：来自 agent 和动态地图区域（M′）；
        
    
- 这两个 attention：
    
    - 一个从 agent 特征中抽取轨迹交互上下文；
        
    - 一个从动态地图区域（通过 dynamic map collection）中抽取空间语义；
        
    
- 最终结果合并为新的 query content $C^{j+1}$。
    


#### Step 4: GMM Prediction

- 使用$C^{j+1}$ 进行 **高斯混合模型（GMM）预测**：
    
    - 输出：每个 motion 模式下的未来轨迹分布 $Z^{j+1}_{1:T} \in \mathbb{R}^{K \times T \times 6}$
        
    - 每个时间步预测一个二维高斯分布（$\mu_x, \mu_y, \sigma_x, \sigma_y, \rho, p$）
        
    
- 最大化似然估计计算损失
####  Step 5: 动态查询更新（Query Updating）

- 使用预测的轨迹终点（第 T 帧的 $Y_T^{j+1}$）更新 dynamic searching query：
    
    $Q^{j+1}_S = \text{MLP}(\text{PE}(Y_T^{j+1}))$
    
- 进入下一层用于 cross-attention。


### Example
我们通过一个**典型场景**，从输入到输出来详细说明：

---
### **🎯 场景设定**

你是一辆车（Agent A），在一个 T 字路口前等待红绿灯，前方有三条可能的道路：

1. 左转
    
2. 直行
    
3. 右转
    

你现在给了模型：

- **历史轨迹（过去1秒的位置、速度、朝向）**
    
- **道路地图（vectorized polyline）**
    
- **其他 agent 的历史轨迹**
    

---

### **🧠 Step 1：编码（Encoder）**

- 使用 **Polyline Encoder** 将轨迹 & 地图编码为 token；
    
- 使用 **局部 self-attention 的 Transformer Encoder** 提取场景上下文；
    
- 得到：
    
    - A_{\text{past}}：目标 agent 的历史上下文特征；
        
    - M：道路上下文；
        
    - 所有 agent 的聚合特征。
        
    

---

### **🌀 Step 2：初始化 64 个 Motion Query Pair**

- 每个 Static Intention Query I_k 是一个意图点（比如：向左前方 10 米）；
    
- 每个 Query Pair 包含：
    
    - 静态位置编码（代表“我要往那里走”）
        
    - 初始动态位置（先等于意图点）
        
    

---

### **🔁 Step 3：Decoder 第 1 层**

  

对于每个 query：

1. **Self-Attention**：各个模式彼此交流；
    
2. **Cross-Attention**：
    
    - 利用动态 query 去 query 地图和其他 agent 的特征；
        
    - 聚焦预测路径上的多车交互 & 道路限制；
        
    
3. **GMM 输出**：
    
    - 每个 query 输出一条轨迹的概率分布；
        
    - 预测未来 8s 每帧位置（+速度），作为 GMM（高斯混合）参数；
        
    
4. **Trajectory Sampling**：
    
    - 每个 query 给出一条轨迹（取 GMM 中心），并得到末尾位置；
        
    
5. **更新 Dynamic Query**：
    
    - 动态查询的位置更新为该 query 的末端轨迹点。
        
    

---

### **🔁 Step 4：Decoder 第 2～6 层**

- 重复 refinement：根据上一层预测的轨迹终点更新 dynamic query；
    
- 每一层逐步细化轨迹、理解复杂交互（如是否避让、是否加速）。
    

---

### **🧪 Step 5：输出最终预测结果**

- 共有 64 条候选轨迹（每个 query 预测一条）；
    
- 使用 NMS（Non-Maximum Suppression）选择 **6 条置信度最高的轨迹** 作为最终输出；
    
- 每条轨迹都对应一个“运动模式”：
    
    - e.g. 轨迹1 = 向左转，轨迹2 = 直行，轨迹3 = 掉头…


## **🧭 输出结果示意（假设你是车 A）：**
轨迹 1：左转 → 6s 后停在左侧车道（概率 0.25）
轨迹 2：直行 → 加速通过十字路口（概率 0.40）
轨迹 3：右转 → 减速转入辅道（概率 0.15）
轨迹 4~6：低概率轨迹（如掉头、停车等）

总结：> **运动模式**是对未来轨迹走向的抽象，每个 Motion Query Pair 专注一种潜在模式，MTR 通过静态意图点 + 动态微调，逐步细化每种模式的预测轨迹，并最终选出多条可信未来路径。





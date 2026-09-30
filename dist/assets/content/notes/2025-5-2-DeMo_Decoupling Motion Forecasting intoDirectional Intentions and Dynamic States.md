## Motivation
![](assets/Pasted%20image%2020250502115227.png)
- 过去的方法对轨迹表示能力以及轨迹和时空环境的交互能力较弱，如只使用一种mode查询
- 文章的方法使用多个modes进行查询，同时将查询分成两部分：基于原始mode查询来捕获方向意图，和动态状态查询覆盖未来轨迹的多步，然后合起来就是图1(c)，多个状态和方向，覆盖多个可能状态，然后使用attention 和mamba来处理这些查询


## 方法
### 问题
在给定的高精地图（HD map）和驾驶场景中的智能体（agents）的情况下，运动预测（motion forecasting）旨在预测感兴趣的智能体未来的轨迹。高精地图由车道或交叉口的若干条折线组成，而智能体则是交通参与者，如车辆和行人。地图$M \in R^{N_m ×L×C_m}$ 是通过将每条线分割成若干较短的线段而生成的，其中$N_m$、$L$和$C_m$分别表示地图折线的数量、分割的线段数量和特征通道的数量。我们将智能体的历史信息表示为$A \in R_{N_a ×T_h ×C_a}$ ，其中$Na$、$T_h$和$C_a$分别是智能体的数量、历史时间戳的数量和运动状态（例如，位置、航向角、速度）。此外，感兴趣的智能体的未来轨迹$A_f \in R^{N_{aoi} ×T_f ×2}$ 是估计目标，其中$N_{aoi}$和$T_f$分别表示选定的智能体的数量和未来时间戳的数量。

### Scene context encoding
给定智能体的向量化表示 A 和高清地图的向量化表示 M，我们首先采用独立的编码器分别处理它们。具体来说，我们使用基于 PointNet 的折线编码器（**将折线编码成向量**），来处理地图表示 M，生成地图特征 $F_{m} \in R^{N_m ×C}$ 。对于智能体 A，我们用几个单向 Mamba 聚合历史轨迹特征 $F_a \in R^{N_a ×C}$ 直到当前时间。随后，通过连接它们来形成场景上下文特征 $F_s \in R^{(N_a +N_m )×C}$ 
$$F_{\mathrm{m}}=\text{PointNet(M)},\quad F_{\mathrm{a}}=\mathrm{UniMamba}(\mathrm{A}),\quad F_{\mathrm{s}}=\text{Transformer}(\mathrm{Concat}(F_{\mathrm{a}},F_{\mathrm{m}})).$$
### Trajectory decoding with decoupled queries
#### Dynamic state consistency

![](assets/Pasted%20image%2020250502202632.png)

$$\begin{aligned}&Q_{\mathrm{s}}=\mathrm{MLP}([t_1,t_2,\cdots,t_{T_\mathrm{s}}]),\\&Q_{\mathrm{s}}=\text{MultiHeadAttn}(\mathrm{Q}=Q_\mathrm{s},\mathrm{K}=F_\mathrm{s},\mathrm{V}=F_\mathrm{s}),\\&Q_{\mathrm{s}}\Large=\mathrm{BiMamba}(Q_\mathrm{s}).\end{aligned}$$
- state query 和 scene text交互
- $Q_\mathrm{s}\in\mathbb{R}^{N_\mathrm{aoi}\times T_\mathrm{s}\times C}$ 


#### Directional intention localization

$$Q_\mathrm{m}=\text{MultiHeadAttn}(\mathbb{Q}=Q_\mathrm{m},\mathbb{K}=F_\mathrm{s},\mathbb{V}=F_\mathrm{s}),$$

$$Q_\mathrm{m}=\text{MultiHeadAttn}(\mathbb{Q}=Q_\mathrm{m},\mathbb{K}=Q_\mathrm{m},\mathbb{V}=Q_\mathrm{m}).$$
$Q_\mathrm{m}\in\mathbb{R}^{N_\mathrm{aoi}\times K\times C}$表示了多个不同运动模式，每个查询解码K条的每条轨迹，使用multiheadattn来定位潜在方向意图

#### Hybrid query coupling
$$\begin{aligned}&Q_{\mathrm{h}}=\text{MultiHeadAttn}(\mathrm{Q}=Q_\mathrm{h},\mathrm{K}=F_\mathrm{s},\mathrm{V}=F_\mathrm{s}),\\&Q_{\mathrm{h}}=\text{HybridMultiHeadAttn}(\mathrm{Q=Q_h,K=Q_h,V=Q_h}),\\&Q_{\mathrm{h}}=\text{ModeMultiHeadAttn}(Q=Q_\mathrm{h},\mathrm{K}=Q_\mathrm{h},\mathrm{V}=Q_\mathrm{h}),\\&Q_{\mathbf{h}}=\mathrm{BiMamba}(Q_\mathrm{h}).\end{aligned}$$
- 整合动态状态和方向意图， Qm 和 Qs 相加，形成混合时空查询 $Q_{h} ∈R^{N_{aoi} ×K×T_s ×C}$ 。然后，利用混合耦合模块（Hybrid Coupling Module）进一步处理 Qh，并生成用于未来轨迹的综合表征，

#### loss
回归损失 $\mathcal{L}_{\mathrm{reg}}$ 和分类 $\mathcal{L}_\mathrm{cls}$  用于监督预测轨迹及其相关概率分数的准确性 此外，我们引入了两个辅助损失，分别是针对时间状态中间特征的  $\mathcal{L}_{\mathrm{ts}}$ 和针对运动模式中间特征的  $\mathcal{L}_{\mathrm{m}}$。前者增强了各个时间步长上动态状态的连贯性和因果关系，而后者赋予了模式（mode）独特的方向意图。

$$\mathcal{L}=\mathcal{L}_\mathrm{reg}+\mathcal{L}_\mathrm{cls}+\mathcal{L}_\mathrm{ts}+\mathcal{L}_\mathrm{m}.$$


### 实验指标

#### minADE (Minimum Average Displacement Error)

**定义**：

在多个预测轨迹中，选出与真实轨迹误差最小的一个，然后计算这个轨迹在 **所有时间步上的平均误差**。
$\text{minADE}k = \min{i=1,\dots,k} \frac{1}{T} \sum_{t=1}^{T} \| \hat{Y}i^t - Y{\text{gt}}^t \|_2$

- k：表示预测了 k 条轨迹。
    
- T：预测时长内的时间步数量。
    
- $\hat{Y}_i^t$：第 i 条预测轨迹在时间 t 的位置。
    
- $Y_{\text{gt}}^t$：真实轨迹在时间 t 的位置。
    
  
📌 **用来衡量整体轨迹拟合精度，误差越小越好。**

---

#### minFDE (Minimum Final Displacement Error)

**定义**：

在多个预测轨迹中，选出终点与真实轨迹终点最接近的一条，计算其 **最终时间点的位置误差**。

$\text{minFDE}k = \min{i=1,\dots,k} \| \hat{Y}i^T - Y{\text{gt}}^T \|_2$

  

📌 **关注终点精度，反映模型能否准确预测目标将到达哪里。**

---
#### MR (Miss Rate)
**定义**：

计算所有测试样本中，真实轨迹终点与任意预测轨迹终点都相距 **超过某个阈值（如2米）** 的比例。
  

$\text{MR}k = \frac{1}{N} \sum{n=1}^{N} \mathbb{1}\left[\min_i \| \hat{Y}{i,n}^T - Y{n,\text{gt}}^T \|_2 > \delta\right]$

- 通常$\delta$= 2.0 米。
    
- N：样本数量。

📌 **度量严重偏离真实轨迹的比例，越小越好。**

---

#### b-minFDE (Brier-weighted Final Displacement Error)

**定义**：
考虑预测轨迹的概率分布，在预测终点误差的基础上增加了置信度惩罚。

$\text{b-minFDE}k = (1 - p{\text{best}})^2 \cdot \| \hat{Y}{\text{best}}^T - Y{\text{gt}}^T \|_2$

- $p_{\text{best}}$：模型认为最可能的那条预测轨迹的概率分数。
    

📌 **越能准确地给高置信度的轨迹更小误差，得分越好。**

---

#### 多车（multi-agent）指标
### **avgMinADE / avgMinFDE**

**定义**：

分别对场景中每一个 agent 使用 minADE/minFDE，并计算平均值。

  

$\text{avgMinADE}k = \frac{1}{N} \sum{n=1}^{N} \text{minADE}_k^{(n)}$

  

📌 **用于多车预测场景，越小表示整体预测效果越好。**

---

#### actorMR (Actor Miss Rate)

**定义**：

和 MR 类似，但用于多 agent 预测，每个 agent 单独计算是否“miss”。

  

📌 **反映系统在多目标场景下的整体鲁棒性。**

---

### **补充说明：**

- 模型在 Argoverse 2 上通常使用 K=1, 6，表示单条轨迹或6条轨迹中最优那一条。
    
- 在 nuScenes 上使用 K=5, 10。
    
- 模型需要同时兼顾多模态性（多种可能未来）与准确性。
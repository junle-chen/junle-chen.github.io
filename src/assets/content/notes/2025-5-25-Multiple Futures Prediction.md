![](assets/Pasted%20image%2020250525164617.png)

历史输入 + 地图上下文
      ↓
PoV 标准化 + 编码器（RNNEnc）
      ↓
动态注意力编码器（DynEnc）
      ↓
推断离散 latent 模式 z^n（每个 agent 一个）
      ↓
→→→ 解码器（RNN） →→→ 多步未来轨迹预测 y_{t+1:t+T}
            ↑
  交互状态更新（所有 agent 协同预测）
## 输入模块：多 agent 状态 + 地图上下文

- 每个 agent 的历史轨迹 $x_{t-\tau:t}^n$​，包含其位置、速度、朝向等
    
- 上下文信息 III，如地图、车道线，用 CNN 提取
## 视角标准化（Point-of-View）

每个 agent 的输入都被转换为“自车视角”--参考系变化，然后我们可以预测车左转右转等等：

- +x 轴对齐朝向
    
- 使得模型具有**方向不变性**和更好的泛化能力

如图实验中不同模式的预测

![|855](assets/Pasted%20image%2020250525210343.png)
## 编码器（RnnEnc）

- 每个 agent 独立使用一个 RNN（如 GRU）对其历史状态编码
    
- 输出为一个固定维度向量，表示该 agent 的历史行为特征


![|695](assets/Pasted%20image%2020250525164631.png)
## 动态注意力编码器（Dynamic Encoder，DynEnc）

这是 MFP 的核心创新之一：

- 使用 Radial Basis Function（RBF）进行**距离敏感的注意力匹配**
    $$\mathrm{score}_{ij}=\exp\left(-\frac{\|\mathrm{key}_i-\mathrm{key}_j\|^2}{\sigma^2}\right)$$
    - 用 key 之间的距离来衡量相似性（RBF 比 dot-product 更适合表达空间/语义距离）
- 每个 agent 只关注“对自己预测有影响的其他 agent”
    - 匹配出 N 个关键 agent，将它们的状态（key）送入编码器
    -  编码器将这些状态通过（例如）MLP 或 transformer 层聚合成一个最终表示
    -  最后这个表示作为输入传递给轨迹解码器，用于预测未来行为
- 该机制比 Transformer 的 softmax 更适合建模物理空间中的影响力衰减
    

🔍 优点：

- 支持任意数量 agent
    
- 对排列顺序不敏感（permutation equivariant）
    
- 自动聚焦关键交互（如让行、并线）
------------

所有 agent 状态 → key 向量
         ↓
 ego 与其他 key 做 RBF 匹配 → 选 top-N
         ↓
 将选中的 key 输入编码器（MLP / attention / slot）
         ↓
 得到交互表示 h^{interact}
         ↓
 → 解码器 RNN
 → latent 推断网络

## 离散 laten  z^n

每个 agent 会推断一个离散 latent variable $z^n \in \{1, ..., K\}$，代表其未来行为意图，例如：

- 保守直行
    
- 激进变道
    
- 停车等待
    

该 latent：

- 只采样一次
    
- 控制整个未来预测序列（非逐步采样，避免信息泄漏与过拟合）
    
- 在训练中通过变分推理推断（详见 ELBO）
    

🔍 优点：

- 多模态建模无需标签
    
- 行为模式更具有语义解释性
    
- 支持精确 log-likelihood 计算（无需蒙特卡洛

## 解码器（RNN）

- 每个 agent 使用共享参数的 RNN 解码器（GRU）
    
- 接收：
    
    - 其历史 hidden state htnh_t^nhtn​
        
    - 上一步预测值
        
    - 自身 latent 模式 znz^nzn
        
    - 联合场景表示（world）
        

输出为每个时间步的状态分布参数（例如高斯均值和方差），可用于采样轨迹


## 多 agent 联合 rollout

- 所有 agent 并行预测 $y_{t+1:t+T}$​
    
- 每一步预测都会影响下一步输入，**体现交互性**
    
- 支持 hypothetical rollout（假设 ego 做某事时他人如何响应）
hypothetical rollout指的是在推理阶段，**人为设定 ego 的未来行为**，然后观察其他 agent 如何响应。比如：

- 给定 ego 的未来轨迹为一条向左变道的路径
    
- 其他 agent 仍用 MFP rollout 模型进行预测
    
- 由于所有 agent 是联合 rollout 的，其他 agent 会将 ego 的“假设动作”当作真实输入，产生相应变化（如减速、变线等）
    

这种功能对 **行为预测 + 规划耦合** 特别有用。

Time:      t       t+1       t+2       t+3     ...
        ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
Agent 1 │ y_t │→│ y_t+1│→│ y_t+2│→│ y_t+3│→ ...
        └─────┘  └─────┘  └─────┘  └─────┘
               ↘        ↘        ↘
Agent 2         └→ uses └→ uses └→ uses
                 y_t+1     y_t+2    y_t+3  of Agent 1

|类别|创新点|说明|
|---|---|---|
|模型设计|离散 latent variable znz^n|行为模式抽象明确，不需要连续采样|
|多模态性|自动学习潜在行为模式|不依赖人工标签或预定义动作集|
|多 agent 联合预测|所有 agent 同时预测，交互编码共享|实现真实交互感知|
|动态注意力机制|RBF-based 注意力替代 softmax|区分近邻与远处 agent，有空间感知能力|
|假设推理能力|支持“如果 ego 改变策略，其他 agent 会如何”|有效用于 planning 与 RL|
|推理效率|不依赖 Monte Carlo|支持显式对数似然估计与在线决策|文章

文章还详细解释了损失函数的计算，使用ELBO


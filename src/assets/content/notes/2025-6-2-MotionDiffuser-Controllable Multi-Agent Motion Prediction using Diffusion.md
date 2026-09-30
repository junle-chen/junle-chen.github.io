本文介绍了 MotionDiffuser，一种基于去噪扩散模型（Denoising Diffusion Models）的创新框架，用于可控的多智能体未来轨迹预测。该模型旨在解决自动驾驶中运动预测的固有挑战：多模态性、联合推理和可控性 。

#### 1. 核心思想与优势

- **扩散模型基础**：MotionDiffuser 利用去噪扩散模型学习多智能体未来轨迹的联合分布。这类模型通过迭代地从纯高斯噪声中去噪样本来生成数据，能够捕捉复杂、高维和多模态的分布 。
    
- **多模态性**：模型能学习高度多模态的分布，以捕捉未来各种可能的轨迹结果，应对交通场景的不确定性 。
    
- **训练简洁高效**：预测器设计简单，仅需单个 L2 损失进行端到端训练，不依赖于轨迹锚点 。
    
- **置换不变性**：模型以置换不变的方式学习多智能体运动的联合分布，确保预测结果不受智能体输入顺序的影响 。（比如输入agent2,agent3不会影响实验结果
    
- **压缩轨迹表示**：通过主成分分析（PCA）实现轨迹的压缩表示。这不仅提高了模型性能和推理速度，还使得精确样本对数概率的计算更为高效 。(将Nf\*Nt压缩成Np，其中Nt为时间步，Nf为特征数)
    
- **可控采样框架**：引入通用约束采样框架，允许根据可微分的成本函数进行轨迹采样，从而强制执行规则、物理先验或创建定制仿真场景 。
    
- **SOTA 性能**：MotionDiffuser 结合现有骨干网络（如 Wayformer）在 Waymo Open Motion Dataset 上实现了多智能体运动预测的最先进结果 。
    

#### 2. 模型架构与流程（结合图 2）
![](assets/Pasted%20image%2020250603210149.png)
MotionDiffuser 的流程分为训练和推理两个阶段：

**A. 训练阶段 (Training)**

1. **场景输入 (Scene Input)**：模型接收包含智能体历史（History）、上下文智能体（Context Agents）、交通灯（Traffic Light）和道路图（Road Graph）等元素。
2. **编码器 (Encoder)**：这些场景元素通过 Transformer 编码器被编码成一组**条件令牌 C (Condition Tokens)** 。
    
3. **噪声注入**：将真实的地面轨迹（GT Trajectory）s1​,s2​ 与从高斯分布 $N(0,σ^2I)$ 中采样的随机噪声 ϵ 相加，生成**噪声轨迹（Noisy Trajectory）**。这意味着 x=x0​+ϵ 。
    
4. **去噪器 (Denoiser)**：去噪器接收噪声轨迹 x+ϵ 和噪声水平 σ 作为输入，并 attend 到条件令牌 C 。其目标是预测出**去噪轨迹（Denoised Trajectory）**，即原始的真实轨迹 x 。
    
5. **损失函数**：模型通过最小化预测的去噪轨迹与真实轨迹之间的**简单 L2 损失**进行端到端训练 。
    

**B. 推理阶段 (Inference)**

1. **初始噪声采样**：从最高噪声水平 σmax​ 下的纯噪声 $N(0,σ_{max}^2​I)$ 中采样得到一组初始轨迹（例如 s1​,s2​）。
2. **迭代去噪**：这些噪声轨迹被送入去噪器，通过**迭代的去噪过程**逐步提炼。去噪器在每个步骤中接收当前的噪声轨迹和条件令牌 C，并预测去噪方向 。
    
3. **轨迹生成**：经过多次迭代（例如 32 步），去噪器将纯噪声转化为一组** plausible 的未来轨迹分布 spred​** 。
    
4. **可选约束 (Optional Constraint x)**：在去噪过程中，可以**选择性地注入约束**，形式为任意可微分的损失函数。这使得模型能够生成满足额外先验或行为要求的轨迹 。
    

#### 3. 关键技术细节

- **分数函数与去噪器关系**：扩散模型不直接学习难以归一化的概率密度函数 pθ​(x)，而是学习其**分数函数 ∇x​logpθ​(x;σ)** 。去噪器 D(x;σ) 通过关系 ∇x​logp(x;σ)=(D(x;σ)−x)/σ2 与分数函数相关联 。分母的 σ2 是为了正确缩放去噪器的预测残差，使其与概率梯度尺度相匹配，源于得分匹配理论和高斯噪声的方差 。
    
- **ODE 动力学**：数据生成通过求解一个 ODE 实现：
$\boldsymbol{x}_{0}=\boldsymbol{x} ( T )+\int_{T}^{0}-\dot{\sigma} ( t ) \sigma( t ) \nabla_{\boldsymbol{x}} \operatorname{l o g} p_{\boldsymbol{\theta}} ( \boldsymbol{x} ( t ) ; \sigma( t ) ) d t$ 。其中 −σ˙(t)σ(t) 项来源于反向 SDE 的漂移项，σ(t) 因子用于平衡不同噪声水平下梯度对样本的影响 。
    
- **置换等变去噪器**：为了处理多智能体的无序性，去噪器采用了基于 Transformer 的**置换等变架构**。通过自注意力层和不使用智能体维度的位置编码，确保模型输出对智能体顺序不变 。
    
- **PCA 潜在扩散**：
    - **原因**：轨迹在时间和几何上平滑，PCA 能高效捕捉低维结构，提高推理速度、约束处理效果和模型性能 。
        
    - **过程**：
        1. 线性插值/外推填充轨迹缺失时间步 。
            
        2. 轨迹居中、旋转到 +y 方向并展平 。
            
        3. 计算主成分矩阵 $W_{pca}​$ 和均值 sˉ′（可能包含白化）。
            
        4. 轨迹从原始高维空间 (Nt\*​Nf​) 转换到低维 PCA 空间 (Np​)：$\hat{s}_{i}=( s_{i}-\bar{s} ) W_{\mathrm{p c a}}^{T} \Leftrightarrow\bar{s}_{i}=\hat{s}_{i} ( W_{\mathrm{p c a}}^{T} )^{-1}+\bar{s}$。MotionDiffuser 在此 Np​=10 的低维空间中进行扩散 。
            
- **可控采样**：
    - **原理**：通过在去噪过程中，在标准分数函数梯度上叠加一个**约束梯度评分** $\nabla_{\boldsymbol{S}} \operatorname{l o g} q ( \boldsymbol{S} ; \boldsymbol{C}, \sigma)$，实现可控性 。
        
    - **近似方法**：约束梯度评分近似为$\lambda\frac{\partial} {\partial S} \mathcal{L} \Big( D ( S ; C, \sigma) \Big)$ 。该近似利用了去噪器输出 D(S;C,σ) 即使在有噪声输入 S 的情况下也能接近真实数据流形的特性 。L相当于约束，D可以看作当噪声为0接近真实轨迹
        
    - **吸引子成本**：$\mathcal{L}_{\mathrm{a t t r a c t}} ( D ( \mathbf{S} ; \mathbf{C}, \sigma) )=\frac{\sum| ( D ( \mathbf{S} ; \mathbf{C}, \sigma)-\mathbf{S}_{\mathrm{t a r g e t}} ) \odot\mathbf{M}_{\mathrm{t a r g e t}} |} {\sum| \mathbf{M}_{\mathrm{t a r g e t}} |+e p s}$​，用于引导轨迹到达特定目标点 。
        
    - **排斥子成本**：$\mathbf{A}=\operatorname* {m a x} \Bigl( \bigl( 1-\frac{1} {r} \Delta( D ( \mathbf{S} ; \mathbf{C}, \sigma) ) \bigr) \odot( 1-I ), 0 \Bigr)$，${\cal L}_{\mathrm{r e p e l l}} ( D ( \boldsymbol{S} ) )=\frac{\sum\boldsymbol{A}} {\sum( \boldsymbol{A} > 0 )+e p s}$用于避免智能体间碰撞。(1−I) 用于排除智能体自身与自身的距离计算 。
        
    - **约束分数阈值化 (ST)**：将约束分数裁剪到特定范围，即 $\nabla_{S} \operatorname{l o g} q ( S ; C, \sigma) :=\mathrm{c l i p} ( \sigma\nabla_{S} \operatorname{l o g} q ( S ; C, \sigma), \pm1 ) / \sigma$。这提高了采样稳定性，防止梯度过大，并帮助保持生成轨迹的真实性 。
        

#### 4. 实验结果

- **WOMD 交互式数据集**：在 Waymo Open Motion Dataset 交互式拆分上进行评估 。
    
- **SOTA 性能**：在 minSADE、minSFDE 等指标上取得最先进结果。相较于 Wayformer（相同骨干），MotionDiffuser 性能显著提升 。
    
- **可控性验证**：
    - **吸引子**：能有效引导轨迹到目标，同时保持高真实性（minSADE 0.533），优于仅优化后处理（minSADE 4.563，但完美满足约束）或 GTC [53]（minSADE 1.18）。
        
    - **排斥子**：显著降低联合预测的重叠率（从 0.059 降至 0.008），有效减轻碰撞，同时保持轨迹真实性 。
        
- **消融研究**：证明了 PCA 轨迹表示、Transformer 架构和自注意力层对模型性能的重要性 。ST 策略对约束满足度至关重要 。
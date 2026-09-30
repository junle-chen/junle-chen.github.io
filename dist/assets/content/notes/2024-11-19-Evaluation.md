---
layout: post
title: LLM-Evaluation
gh-repo: https://github.com/junle-chen/junle-cc-website
tags:
  - LLM
mathjax: true
gh-badge:
  - star
  - follow
  - fork
comments: true
thumbnail-img: ../assets/img/nailong_images/image_2.jpg
share-img: /assets/img/path.jpg
cover-img: /assets/img/path.jpg
---

### Perplexity of fixed-length models
PPL(perplexity) is one of the most common metrics for evaluating models.
If we have a tokenized sequence $X = (x_{0},x_{1},\dots x_{t})$, the perplexity of X is
$$ P P L ( X ) = e x p \left\{ - \frac { 1 } { t } \sum _ { i } ^ { t } \log p _ { \theta } ( x _ { i } | x < i ) \right\}$$
where $\log p_{\theta}(x_{i}|x<i)$ is the log-likelihood of the ith token conditioned on the proceeding token $x_{<i}$. It uses the first i-1 tokens to predict ith token.

we can just simplify the formula like this:
$$PPL(X) = e^{loss}$$
where loss means the CrossEntropyLoss 
$$ L o s s = - \frac { 1 } { N } \sum _ { i = 1 } ^ { N } \log P ( y _ { i } | x )$$
N: the number of the tokens
$P(y_{i}|x)$ : the probability of predicting $y$ in the position of i using the previous tokens.

### Using sliding window 
we can set hyperparameters `stride` to evaluate.
For example, giving the `stride`  is 512, the total text length is 2000, max_length is 1024
*first window*
- **input:** [0:1024] (from 0 to 1023 tokens)
- **target:**[512:1024] (just mask the first 512 tokens), for example, target_ids = [-100, -100, ..., -100, token_512, token_513, ..., token_1023]
- **Model prediction:** predict the probability distribution of the next 512 tokens through the first 1024 tokens. It is an autoregressive model.
*second window*
- **input:** [512:1536] (from 0 to 1023 tokens)
- **target:**[1024:1536] (just mask the first 512 tokens)
......


### BLEU
just see the website [BLEU SCORE](https://coladrill.github.io/2018/10/20/%E6%B5%85%E8%B0%88BLEU%E8%AF%84%E5%88%86/)
Use the N-Gram, for example 
#### Assume:
Reference Translation: "The cat is on the mat"

Candidate Translation (Machine Translation): "The cat is on mat"

We'll calculate the BLEU score using 1-gram and 2-gram.

#### Step 1: Calculate n-gram Precision

First, we calculate the matching for 1-gram and 2-gram.

#### 1. 1-gram Precision

- **1-gram represents single word matches.**
- 1-grams in Reference: `["The", "cat", "is", "on", "the", "mat"]`
- 1-grams in Candidate: `["The", "cat", "is", "on", "mat"]`

We compare the candidate translation with the reference:

- Matches: "The", "cat", "is", "on", "mat"

There are 5 matches, and the candidate has 5 words, so the 1-gram precision is:

$p_1 = \frac{5}{5} = 1.0$

#### 2. 2-gram Precision

- **2-gram represents matches of consecutive pairs of words.**
- 2-grams in Reference: `["The cat", "cat is", "is on", "on the", "the mat"]`
- 2-grams in Candidate: `["The cat", "cat is", "is on", "on mat"]`

We compare the candidate and reference:

- Matches: "The cat", "cat is", "is on"

There are 3 matches, and the candidate has 4 2-grams, so the 2-gram precision is:

$p_2 = \frac{3}{4} = 0.75$
### Step 2: Calculate BP (Brevity Penalty)

The Brevity Penalty (BP) is used to penalize overly short translations. It is defined as:

$BP = \begin{cases} 1 & \text{if } c > r \\ e^{(1 - r/c)} & \text{if } c \leq r \end{cases}$

Where:

- c is the length of the candidate translation (number of words).
- r is the length of the reference translation.

In our example:

- Length of Candidate (c) = 5
- Length of Reference (r) = 6

Since c<rc < rc<r:

$BP = e^{(1 - \frac{6}{5})} = e^{-0.2} \approx 0.8187$

### Step 3: Calculate BLEU Score

Now we use the n-gram precisions and BP to calculate the BLEU score. Let's consider using 1-gram and 2-gram precisions with equal weights (i.e., w1=w2=0.5):

$\text{BLEU} = BP \cdot \exp \left( w_1 \cdot \log(p_1) + w_2 \cdot \log(p_2) \right)$

Substituting the values:

$BLEU=0.8187⋅exp(0.5⋅log(1.0)+0.5⋅log(0.75)) =0.8187⋅exp⁡(0+0.5⋅log⁡(0.75))= 0.8187⋅exp(0+0.5⋅log(0.75))$$=0.8187⋅exp⁡(−0.14385)≈0.8187⋅0.8665≈0.7091$

Thus, the final BLEU score is approximately 0.7091, or 70.91%.
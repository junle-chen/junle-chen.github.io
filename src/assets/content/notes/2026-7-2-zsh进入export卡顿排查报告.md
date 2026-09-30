---
layout: post
title: zsh 进入 /export 卡顿排查报告
subtitle: powerlevel10k prompt hook 在 autofs + NFS 路径上触发等待的排查记录。
date: 2026-07-02
gh-repo: https://github.com/junle-chen/junle-cc-website
tags:
  - note
  - zsh
  - powerlevel10k
  - NFS
  - autofs
  - Linux
mathjax: true
gh-badge:
  - star
  - follow
  - fork
comments: true
thumbnail-img: ../assets/img/nailong_images/image_6.jpg
share-img: /assets/img/path.jpg
cover-img: /assets/img/path.jpg
---

## 1. 问题概述

在服务器上使用普通 zsh 进入 `/export/zxcpu2/junle` 时，shell 会出现明显卡顿：

```bash
cd /export/zxcpu2/junle
```

表现为命令执行后 prompt 长时间不返回。继续输入 `pwd` 也没有正常输出。

该问题并非所有 shell 都会触发。使用 bash 或不加载配置的 zsh 进入同一路径时，表现正常。

## 2. 结论

根因不是 zsh 本身慢，也不是基础网络延迟过高。

更准确的原因是：

```text
powerlevel10k 的 prompt 刷新逻辑触发了 /export 上的 autofs/NFS 等待
```

`/export/zxcpu2` 是 `autofs + NFS` 挂载路径。普通 zsh 加载了 `powerlevel10k` 后，prompt 刷新会执行较多文件系统探测。进入 `/export` 后，这些探测可能触发 autofs 等待，导致 zsh 卡在 prompt 刷新阶段。

## 3. 环境信息

目标路径：

```bash
/export/zxcpu2/junle
```

挂载信息：

```bash
findmnt -T /export/zxcpu2/junle -o TARGET,SOURCE,FSTYPE,OPTIONS
```

关键结果：

```text
/export/zxcpu2 systemd-1       autofs
/export/zxcpu2 zxcpu2:/ssddata nfs4
```

磁盘使用情况：

```bash
df -hT /export/zxcpu2/junle
```

关键结果：

```text
Filesystem      Type  Size  Used Avail Use% Mounted on
zxcpu2:/ssddata nfs4   42T   42T   13G 100% /export/zxcpu2
```

NFS 服务端基础网络延迟：

```bash
ping -c 4 192.168.1.183
```

平均延迟约 `0.152 ms`，没有发现明显网络延迟异常。

## 4. 对照测试

不加载配置的 bash：

```bash
bash --noprofile --norc -ic "cd /export/zxcpu2/junle; pwd"
```

结果正常。

不加载配置的 zsh：

```bash
zsh -f -ic "cd /export/zxcpu2/junle; pwd"
```

结果正常。

普通 zsh 加载配置后，进入 `/export/zxcpu2/junle` 会卡住。

该对照说明：

- `cd` 操作本身不是主要问题
- zsh 程序本身不是主要问题
- 问题与 zsh 配置中的 prompt 逻辑有关

## 5. 关键证据

卡住时检查 zsh 进程状态，发现等待点为：

```text
zsh -i  D+  autofs_wait
```

`autofs_wait` 表示进程正在等待 autofs 自动挂载返回。

这说明 zsh 卡住发生在文件系统访问阶段，而不是 CPU 计算、普通命令执行或网络连通性测试阶段。

## 6. 原因分析

`powerlevel10k` 会在 prompt 刷新时检查多类状态，包括但不限于：

- 当前目录
- Git 仓库状态
- `.git` 目录和父目录
- conda、pyenv、nvm、asdf、rbenv 等运行环境
- direnv、kubectl、aws、gcloud 等工具状态

这些检查在本地文件系统上通常开销很小。

但在 `/export` 这种 `autofs + NFS` 路径上，文件系统探测可能触发自动挂载等待。p10k 的 prompt hook 越复杂，触发该等待的概率越高。

## 7. 已验证但不充分的方案

### 7.1 仅禁用 `vcs` segment

只关闭 p10k 的 Git 状态 segment 后，问题仍然存在。

原因：卡顿不只来自 Git 状态检测，p10k 其它 prompt hook 仍可能触发 `/export` 上的文件系统访问。

### 7.2 使用 `p10k display` 隐藏 segment

使用 `p10k display` 隐藏 prompt segment 后，问题仍然存在。

原因：隐藏 segment 只影响显示，不等于停止 p10k hook 执行。

## 8. 最终处理方案

目标：

- 非 `/export` 路径：保留 powerlevel10k
- `/export` 路径：自动切换为简单 prompt
- 离开 `/export`：恢复 powerlevel10k

在 `~/.zshrc` 中，p10k 加载之后添加以下逻辑：

```zsh
typeset -ga _export_p10k_precmd_functions=(${precmd_functions[@]})
typeset -ga _export_p10k_preexec_functions=(${preexec_functions[@]})

_export_prompt_mode() {
  if [[ $PWD == /export(|/*) ]]; then
    precmd_functions=(${precmd_functions:#_p9k*})
    preexec_functions=(${preexec_functions:#_p9k*})
    PROMPT='%n@%m:%~%# '
    RPROMPT=
  else
    precmd_functions=(${_export_p10k_precmd_functions[@]})
    preexec_functions=(${_export_p10k_preexec_functions[@]})
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd _export_prompt_mode
add-zsh-hook precmd _export_prompt_mode
_export_prompt_mode
```

处理逻辑：

- 保存 p10k 原始 `precmd_functions` 和 `preexec_functions`
- 进入 `/export` 后移除 `_p9k*` hook
- 使用简单 prompt
- 离开 `/export` 后恢复原始 hook

## 9. 验证结果

批处理验证：

```bash
zsh -ic "cd /export/zxcpu2/junle; pwd"
```

结果：

```text
/export/zxcpu2/junle
elapsed=0.37
```

交互验证：

```bash
cd /export/zxcpu2/junle
```

结果：prompt 自动切换为简单版，未再卡住。

离开 `/export`：

```bash
cd /tmp
```

结果：powerlevel10k prompt 恢复。

## 10. 备选方案

如果环境中存在替代挂载路径，可以绕开 `/export` 的 autofs 路径。

本次环境中可用路径：

```bash
cd /exportr/zxcpu2/junle
```

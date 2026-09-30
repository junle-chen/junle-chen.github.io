---
layout: post
title: Codex 服务器代理和 Codex App 远程 SSH 配置
subtitle: Codex 远程代理配置备忘：SSH 端口转发、命令级代理和 Codex App app-server。
gh-repo: https://github.com/junle-chen/junle-cc-website
tags:
  - note
  - codex
  - ssh
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

这是一份 Codex 远程代理配置备忘：用 SSH `RemoteForward` 把服务器端口接到本地代理，默认 shell 保持直连，只让 `codex`、`claude` 和 Codex App 的 `app-server` 走代理。

最终方案：

- 本地端口还是 `7890`。
- 服务器上不要用 `7890`，用 SSH `RemoteForward` 映射出来的远程端口，比如 `17890`。
- 远程 shell 默认不要全局 `export http_proxy`，否则所有命令都会走代理。
- Codex App 通过 SSH 启动远程 `codex app-server`，它使用远程账号的 login shell，所以要保证非交互登录时 `codex` 在 `PATH` 里，并且这个 `codex` 命令自己能带上代理。
- 欢迎信息、MOTD、home usage 这类输出只能出现在交互 SSH 里，不能污染 `ssh host 'command'`，否则可能干扰 Codex App 和其他自动化。

## 1. 整体网络结构

我希望达成的是：

```text
remote codex / claude
        |
        | http_proxy=http://127.0.0.1:17890
        v
remote 127.0.0.1:17890
        |
        | SSH RemoteForward
        v
Mac 127.0.0.1:7890
        |
        v
Clash / VPN / proxy provider
        |
        v
OpenAI / ChatGPT / Codex endpoints
```

重点是 `17890` 是服务器上的端口，`7890` 是 Mac 上的端口。`RemoteForward` 把服务器的 `17890` 转发到 Mac 的 `7890`。

所以在服务器上测试代理时，应该写：

```bash
curl -I -x http://127.0.0.1:17890 https://chatgpt.com/backend-api/codex/responses
```

而不是：

```bash
curl -I -x http://127.0.0.1:7890 https://chatgpt.com/backend-api/codex/responses
```

后者访问的是服务器自己的 `7890`。如果服务器上刚好有别人或系统的 Clash/mihomo 监听这个端口，就会走错出口。我们之前看到过 `cf-ray: ...-HKG` 以及 `Country, region, or territory not supported`，本质就是没有走到预期的本地代理出口。

## 2. 本地 SSH config

在 Mac 的 `~/.ssh/config` 里给服务器写具体 host alias。Codex App 官方文档说明，它会读取 `~/.ssh/config` 里的具体 host alias，并用 OpenSSH 去解析；pattern-only host 不会作为可选 SSH host 出现在 App 里。

推荐写法：

```sshconfig
Host zxcpu1
  HostName zxcpu1.cse.ust.hk
  User junle
  RemoteForward 127.0.0.1:17890 127.0.0.1:7890
  ExitOnForwardFailure yes
```

如果还有 `zxcpu2`、`zxcpu3`、`zxcpu4`，同样加：

```sshconfig
Host zxcpu2
  HostName zxcpu2.cse.ust.hk
  User junle
  RemoteForward 127.0.0.1:17890 127.0.0.1:7890
  ExitOnForwardFailure yes
```

`ExitOnForwardFailure yes` 很重要。否则远程端口绑定失败时，SSH 仍然登录成功，你会误以为代理已经可用。

验证：

```bash
ssh zxcpu1
```

然后在服务器上：

```bash
curl -I -x http://127.0.0.1:17890 https://chatgpt.com/backend-api/codex/responses
```

如果看到类似 `HTTP/2 405` 且 `allow: POST`，说明已经到达了 ChatGPT/Codex 后端。这个接口不是给 `GET/HEAD` 用的，所以 `405` 本身不是坏信号；坏信号是连接失败、DNS 失败，或者返回 region unsupported。

## 3. 服务器默认不要全局走代理

不要在 `~/.zshrc` 或 `~/.profile` 顶层写：

```bash
export http_proxy=http://127.0.0.1:17890
export https_proxy=http://127.0.0.1:17890
```

这样会让 `git`、`curl`、`apt`、实验脚本、数据下载脚本全部默认走代理。共享服务器上这很容易制造奇怪问题。

我的做法是只给需要的命令加函数：

```zsh
claude() {
  local proxy="http://127.0.0.1:17890"
  http_proxy="$proxy" https_proxy="$proxy" HTTP_PROXY="$proxy" HTTPS_PROXY="$proxy" command claude "$@"
}

codex() {
  local proxy="http://127.0.0.1:17890"
  http_proxy="$proxy" https_proxy="$proxy" HTTP_PROXY="$proxy" HTTPS_PROXY="$proxy" command codex "$@"
}
```

这里没有使用 `export`。这几个环境变量只对这一条命令生效，命令结束后不会留在当前 shell。

验证默认 shell 没有代理：

```bash
env | grep -i proxy || echo "no proxy env"
```

验证函数不会污染 shell：

```zsh
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY
codex --version
env | grep -i proxy || echo "after codex: no proxy env"
```

## 4. Codex App 为什么还需要 wrapper

上面的 zsh function 只对交互 shell 有用。Codex App 连接 SSH host 时不是让你手动敲 `codex`，而是通过 SSH 在远程启动 `codex app-server`。

官方文档里有几个关键点：

- Codex App 会从本机 `~/.ssh/config` 发现 SSH host。
- 它会通过 SSH 在远程项目里运行命令、读写文件。
- 它启动远程 Codex app server 时使用远程用户的 login shell。
- 因此远程 login shell 里必须能找到 `codex` 命令。

问题是：非交互 login shell 不一定读取你的 `~/.zshrc`，也不会使用你定义的 `codex()` 函数。所以只改 `~/.zshrc` 不够。

最简单稳定的办法是在远程放一个 `~/.local/bin/codex` wrapper。Codex App 通常会把 `~/.local/bin` 放在 PATH 前面，这样它启动的 `codex app-server` 会先经过这个 wrapper。

示例：

```bash
#!/usr/bin/env bash
set -euo pipefail

proxy="http://127.0.0.1:17890"
export http_proxy="$proxy"
export https_proxy="$proxy"
export HTTP_PROXY="$proxy"
export HTTPS_PROXY="$proxy"

self="$(readlink -f "$0" 2>/dev/null || realpath "$0")"

for candidate in \
  "$HOME"/.nvm/versions/node/*/bin/codex \
  "$HOME"/.local/opt/node-*/bin/codex \
  /usr/local/bin/codex \
  /usr/bin/codex
do
  if [ -x "$candidate" ]; then
    real="$(readlink -f "$candidate" 2>/dev/null || realpath "$candidate")"
    if [ "$real" != "$self" ]; then
      exec "$candidate" "$@"
    fi
  fi
done

echo "real codex binary not found" >&2
exit 127
```

安装：

```bash
mkdir -p ~/.local/bin
vim ~/.local/bin/codex
chmod +x ~/.local/bin/codex
```

验证：

```bash
~/.local/bin/codex --version
```

再验证 app-server 继承代理：

```bash
pkill -f "codex app-server" || true
```

然后让 Codex App 重新连接 SSH host，再在服务器上查：

```bash
ps -ef | grep "codex app-server" | grep -v grep
```

如果需要看环境变量：

```bash
pid=$(pgrep -f "codex app-server" | head -n 1)
tr '\0' '\n' < /proc/$pid/environ | grep -i proxy
```

应该能看到：

```text
HTTP_PROXY=http://127.0.0.1:17890
HTTPS_PROXY=http://127.0.0.1:17890
```

## 5. login shell、zsh 和欢迎信息

Codex App 使用远程用户的 login shell。可以这样看当前账号的 login shell：

```bash
getent passwd "$USER"
echo "$SHELL"
ps -p $$ -o comm=
```

如果想把默认 login shell 改成 zsh：

```bash
sudo usermod -s /usr/bin/zsh "$USER"
```

这个只影响当前用户，不影响别人。

一个容易误判的点：如果 SSH 开了 ControlMaster，旧连接会缓存之前的 shell。改完以后还看到 bash，不一定是 `usermod` 没生效，可能是复用了旧连接。

可以关掉旧 master：

```bash
ssh -O exit zxcpu1.cse.ust.hk
```

或者用全新连接验证：

```bash
ssh -S none -o ControlMaster=no zxcpu1.cse.ust.hk 'echo $SHELL; ps -p $$ -o comm='
```

如果换成 zsh 后，原来的 bash 欢迎界面不见了，原因是 bash 登录会读 `/etc/profile.d/*.sh`，zsh 不一定读。可以在自己的 `~/.zprofile` 里只给交互登录补上：

```zsh
# ponytail: keep the old bash login banner after switching login shell to zsh.
if [[ -o interactive && -r /etc/profile.d/custom_motd.sh ]]; then
  source /etc/profile.d/custom_motd.sh
fi
```

这样手动 `ssh zxcpu1.cse.ust.hk` 会显示欢迎信息，但下面这种非交互命令不会被污染：

```bash
ssh zxcpu1.cse.ust.hk 'echo clean'
```

这对 Codex App 很重要，因为 app-server 走的是机器可读协议，不应该被 MOTD、home usage report 或彩色欢迎字污染。

如果系统的 `/etc/profile.d/custom_motd.sh` 会在非交互 shell 里输出内容，可以在脚本开头加：

```bash
case $- in *i*) ;; *) return ;; esac
```

含义是：只有 interactive shell 才继续执行，否则直接 `return`。

## 6. Codex App 里怎么添加 SSH host

本机 Mac 上确认：

```bash
ssh zxcpu1
```

能登录后，打开 Codex App：

1. 打开 Settings。
2. 进入 Connections。
3. 添加或启用 SSH host。
4. 选择远程项目目录，例如 `/ssddata/junle/verl`。
5. 新建或打开一个 thread，运行位置选择这个 SSH host。

如果连接失败，先不要改一堆配置。按这几层查：

```bash
ssh zxcpu1 'echo clean'
```

应该只输出：

```text
clean
```

再查远程能不能找到 Codex：

```bash
ssh zxcpu1 'command -v codex; codex --version'
```

再查代理：

```bash
ssh zxcpu1 'curl -I -x http://127.0.0.1:17890 https://chatgpt.com/backend-api/codex/responses'
```

如果手动 `curl` 可以，但 Codex App 还是不行，多半是 App 启动的 `codex app-server` 没走 wrapper，或者旧的 app-server 进程还活着。

```bash
ssh zxcpu1 'pkill -f "codex app-server" || true'
```

然后在 Codex App 里重新连接。

## 7. VS Code / IDE extension 的 403

如果看到：

```text
Token exchange failed: token endpoint returned status 403 Forbidden:
Country, region, or territory not supported
```

先判断是本地网页登录阶段失败，还是远程 app-server 请求失败。

几个经验判断：

- 浏览器打开的登录页如果走的是本地网络，而本地网络出口不支持，就会在 token exchange 阶段 403。
- 远程 `codex` 如果走错了服务器本地 `7890`，也可能返回 region unsupported。
- 正确的远程代理应该是 `127.0.0.1:17890`，不是 `127.0.0.1:7890`。
- Cloudflare ray 里如果显示不符合预期的地区，比如 `HKG`，基本说明代理出口不对。

最小验证还是：

```bash
ssh zxcpu1 'env | grep -i proxy || true'
ssh zxcpu1 'curl -I -x http://127.0.0.1:17890 https://chatgpt.com/backend-api/codex/responses'
```

默认环境不应该有 proxy；只有 `codex`、`claude` 或 wrapper 启动的 `codex app-server` 才应该带 proxy。

## 8. 安全边界

`RemoteForward 127.0.0.1:17890 ...` 只绑定服务器 loopback，不会暴露到公网。但共享服务器上，同一台机器的其他本地用户理论上也可能连 `127.0.0.1:17890`，只要他们知道端口并且 tunnel 正开着。

所以我的做法是：

- 不用常见远程端口 `7890`。
- 用一个不容易撞的高位端口，例如 `17890` 或更随机的端口。
- 只在需要时保持 SSH tunnel。
- 用 `ExitOnForwardFailure yes`，避免静默失败。
- 不把代理写成全局环境变量。

如果需要更强隔离，就不要在多人共享节点上长期挂 tunnel；改用个人节点、专用开发机，或者在服务器侧部署受权限控制的本地代理。

## 9. 最终 checklist

本地 Mac：

```bash
curl -I -x http://127.0.0.1:7890 https://chatgpt.com/backend-api/codex/responses
```

SSH config：

```sshconfig
RemoteForward 127.0.0.1:17890 127.0.0.1:7890
ExitOnForwardFailure yes
```

服务器默认环境：

```bash
env | grep -i proxy || echo "no proxy env"
```

服务器代理链路：

```bash
curl -I -x http://127.0.0.1:17890 https://chatgpt.com/backend-api/codex/responses
```

交互命令：

```zsh
codex --version
claude --version
```

Codex App：

```bash
ssh zxcpu1 'command -v codex; codex --version'
ssh zxcpu1 'echo clean'
```

如果这几步都对，Codex CLI、Codex App SSH host、VS Code Codex extension 使用远程服务器时的代理问题基本就定位清楚了。

## 参考

- [Codex remote connections](https://developers.openai.com/codex/remote-connections)
- [Codex app-server](https://developers.openai.com/codex/app-server)
- [Codex environment variables](https://developers.openai.com/codex/environment-variables)

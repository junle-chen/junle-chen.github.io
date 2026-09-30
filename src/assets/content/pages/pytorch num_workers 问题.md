- 在dataloader里面加上multiprocessing_context="forkserver"
- 在主函数运行

```yml
name: cs224n-gpu
channels:
- defaults
- nvidia
dependencies:
- python==3.10
- nvidia::cuda-toolkit==12.1.1
- pip
- pip:
- -r requirements.txt

```
下载的时候清华源找不到nvidia，
在condarc里面加上
```conda
channels: - defaults 
show_channel_urls: true 
channel_alias:https://mirrors.tuna.tsinghua.edu.cn/anaconda 
default_channels: 
-https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main 
-https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/r 
custom_channels: 
conda-forge: https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud 
msys2: https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud 
bioconda: https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud
nvidia: https://conda.anaconda.org/ (add)
```

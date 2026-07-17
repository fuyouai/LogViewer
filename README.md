# LogViewer

Android logcat 日志查看桌面应用，支持多文件标签页、实时过滤和搜索高亮。

## 下载

[📥 下载 v1.0.1](https://github.com/fuyouai/LogViewer/releases/tag/1.0.1)

## 功能

- 支持多种 logcat 格式：threadtime、long、brief、brief+date、process、tag 等
- 多标签页同时打开多个日志文件，每个标签页独立保存过滤状态
- 按日志级别（V/D/I/W/E/F）快速过滤
- 按 Tag 过滤，支持搜索和多选
- 按进程号（PID）过滤，自动推断包名，支持搜索和多选
- 关键字搜索，支持正则表达式
- 搜索时可选择隐藏非匹配行或高亮显示全部
- 上下箭头在搜索结果间快速跳转
- 虚拟滚动，流畅打开大文件
- 导出过滤后的日志
- 中英文切换，默认跟随系统语言
- 侧边栏标签/进程区域可折叠，节省空间
- 暗色主题

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+F` / `Cmd+F` | 聚焦搜索框 |
| `Ctrl+B` / `Cmd+B` | 切换侧边栏 |
| `Enter` | 下一个匹配 |
| `Shift+Enter` | 上一个匹配 |
| `Esc` | 清空搜索 |

## 环境要求

- **Node.js >= 18**（推荐使用 [nvm](https://github.com/nvm-sh/nvm) 安装并管理版本，项目根目录已有 `.nvmrc`，进入目录执行 `nvm use` 即可自动切换）
- **包管理器推荐使用 [pnpm](https://pnpm.io)**（npm 也可，但下文命令以 pnpm 为准）

  首次使用 pnpm 可全局安装：
  ```bash
  npm install -g pnpm
  ```

## 安装与运行

```bash
# 克隆项目
git clone https://github.com/yourname/logviewer.git
cd logviewer

# 安装依赖
pnpm install

# 开发运行
pnpm dev
```

> 说明：Electron 在安装时需要下载原生二进制，已通过 `pnpm-workspace.yaml` 放行其构建脚本。国内网络若下载缓慢，可设置 Electron 镜像后重装：
> ```bash
> ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm install
> ```

## 打包

```bash
# 默认：打包当前平台当前架构
pnpm dist

# macOS Intel
npx electron-builder --mac --x64

# macOS M 系列芯片 (arm64)
npx electron-builder --mac --arm64

# macOS 双架构
npx electron-builder --mac --x64 --arm64

# Windows（macOS 上需要先装 Wine）
npx electron-builder --win
```

打包完成后，安装包会生成在 `dist/` 目录下。

## License

MIT

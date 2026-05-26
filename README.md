# LogViewer

Android logcat 日志查看桌面应用，支持多文件标签页、实时过滤和搜索高亮。

## 功能

- 支持多种 logcat 格式：threadtime、long、brief、process、tag 等
- 多标签页同时打开多个日志文件，每个标签页独立保存过滤状态
- 按日志级别（V/D/I/W/E/F）快速过滤
- 按 Tag 过滤，支持搜索和多选
- 关键字搜索，支持正则表达式
- 搜索时可选择隐藏非匹配行或高亮显示全部
- 上下箭头在搜索结果间快速跳转
- 虚拟滚动，流畅打开大文件
- 导出过滤后的日志
- 暗色主题

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+F` / `Cmd+F` | 聚焦搜索框 |
| `Ctrl+B` / `Cmd+B` | 切换侧边栏 |
| `Enter` | 下一个匹配 |
| `Shift+Enter` | 上一个匹配 |
| `Esc` | 清空搜索 |

## 安装与运行

需要 Node.js 16+。

```bash
# 克隆项目
git clone https://github.com/yourname/logviewer.git
cd logviewer

# 安装依赖
npm install

# 开发运行
npm start
```

## 打包

```bash
# 默认：打包当前平台当前架构
npm run dist

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

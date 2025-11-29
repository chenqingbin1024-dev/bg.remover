# AI 智能图片去背景工具

基于 remove.bg API 的图片去背景 Web 应用。

## 🚀 快速开始

### 本地运行

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   - 在项目根目录创建 `.env` 文件
   - 添加你的 remove.bg API Key：
     ```
     REMOVE_BG_API_KEY=你的API密钥
     ```

3. **启动服务**
   ```bash
   npm start
   ```

4. **访问应用**
   - 打开浏览器访问 `http://localhost:3000`

## 📦 部署到线上

详细的部署指南请查看 [DEPLOY.md](./DEPLOY.md)

### 快速部署（推荐 Render）

1. 将代码推送到 GitHub
2. 在 [Render](https://render.com) 创建新的 Web Service
3. 连接 GitHub 仓库
4. 配置环境变量 `REMOVE_BG_API_KEY`
5. 部署完成！

## 📁 项目结构

```
bg-remover/
├── public/              # 前端静态文件
│   ├── index.html      # 主页面
│   ├── styles.css      # 样式文件
│   ├── app.js          # 前端逻辑
│   ├── pic_origin.jpg  # 示例原图（需自行添加）
│   └── pic_process.jpg # 示例处理后图（需自行添加）
├── server.js           # Node.js 服务器
├── package.json       # 项目配置
├── .env               # 环境变量（不提交到 Git）
└── .gitignore         # Git 忽略文件
```

## ⚙️ 环境变量

- `REMOVE_BG_API_KEY`: remove.bg API 密钥（必需）
- `PORT`: 服务器端口（可选，默认 3000）

## 🔧 技术栈

- **后端**: Node.js (原生 HTTP 模块)
- **前端**: 纯 HTML/CSS/JavaScript
- **API**: remove.bg API

## 📝 功能特性

- ✅ 拖拽/点击上传图片
- ✅ 实时前后对比预览（拖动滑块）
- ✅ 支持 PNG/JPG/WebP 格式
- ✅ 单张图片最大 12MB
- ✅ 下载原图和处理后图片（PNG/JPG）
- ✅ 响应式设计，支持移动端

## 📄 许可证

ISC


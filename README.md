# GenCard - AI 卡牌生成器

<p align="center">
  <strong>🎴 通过prompt轻松创建精美的游戏卡牌</strong>
</p>

GenCard 是一款基于 AIGC 模型的卡牌生成工具，采用两阶段流程设计：先生成或上传原画，再通过 AI 智能生成背景，最终合成精美的游戏卡牌。

## ✨ 功能特性

- 🎨 **AI 原画生成**：输入描述即可生成聚焦人物的原画
- 📤 **支持上传图片**：也可以直接上传已有的人物图片
- 🖼️ **固定布局编辑**：预设的卡牌布局，包含原画框和多个文本框
- 🎯 **智能背景生成**：AI 根据提示词生成背景，同时保留原画内容
- ✨ **精美边框装饰**：自动添加金色/棕色边框，提升卡牌质感
- 💾 **一键下载**：生成完成后可直接下载 PNG 格式卡牌

## 🛠️ 技术栈

| 前端 | 后端 |
|------|------|
| React 18 + TypeScript | Node.js + Express |
| Vite | TypeScript |
| Fabric.js (Canvas编辑) | Sharp (图像处理) |
| Tailwind CSS | 阿里云 DashScope API |

## 📁 项目结构

```
GenCard/
├── frontend/              # React 前端应用
│   ├── src/
│   │   ├── components/   # React 组件
│   │   ├── services/     # API 服务
│   │   ├── types/        # TypeScript 类型
│   │   └── utils/        # 工具函数
│   └── package.json
├── backend/              # Express 后端 API
│   ├── src/
│   │   ├── routes/       # API 路由
│   │   ├── services/     # 业务逻辑
│   │   ├── middleware/   # 中间件
│   │   └── types/        # TypeScript 类型
│   ├── assets/           # 边框素材
│   └── package.json
└── package.json          # 根项目配置
```

---

# 📖 新手安装配置指南

即使没有编程基础，按照以下步骤也能成功运行项目。

## 第一步：准备工作

### 1.1 安装 Node.js

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载左边的 **LTS（长期支持版本）**
3. 双击安装包，一路点击"下一步"即可
4. 验证安装：
   - 按 `Win + R`，输入 `cmd` 打开命令提示符
   - 输入 `node --version`
   - 显示版本号（如 `v18.x.x`）说明安装成功

### 1.2 获取阿里云 API 密钥

项目需要两个阿里云服务：

#### DashScope API Key（用于 AI 生成）

1. 访问 [DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 找到 "API-KEY 管理" → "创建新的 API-KEY"
4. 复制 API Key 保存备用

#### OSS 配置（用于图片临时存储）

1. 访问 [OSS 控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket：
   - 点击"创建 Bucket"
   - 输入名称（如：`my-gencard`）
   - 选择地域（如：华东1-上海）
   - **读写权限选择"公共读"**（重要！）
3. 获取 AccessKey：
   - 点击右上角头像 → AccessKey 管理
   - 创建并保存 AccessKey ID 和 Secret

## 第二步：下载项目

### 方式一：Git 克隆（推荐）

```bash
git clone <repository-url>
cd GenCard
```

### 方式二：下载 ZIP

从项目页面下载压缩包并解压。

## 第三步：安装依赖

在项目根目录打开命令提示符，执行：

```bash
npm run install:all
```

等待 5-10 分钟完成安装。

## 第四步：配置环境变量

### 4.1 创建配置文件

1. 进入 `backend` 文件夹
2. 复制 `.env.example` 文件
3. 重命名为 `.env`

### 4.2 编辑配置

用记事本打开 `backend\.env`，填入以下必需配置：

```env
# DashScope API Key（必填）
DASHSCOPE_API_KEY=你的DashScope_API_Key

# 阿里云 OSS 配置（必填）
ALIYUN_OSS_ACCESS_KEY_ID=你的AccessKeyID
ALIYUN_OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
ALIYUN_OSS_BUCKET=你的Bucket名称
ALIYUN_OSS_REGION=oss-cn-shanghai
```

**OSS Region 对照表：**
| 地域 | Region 值 |
|------|-----------|
| 华东1（杭州） | oss-cn-hangzhou |
| 华东2（上海） | oss-cn-shanghai |
| 华北2（北京） | oss-cn-beijing |
| 华南1（深圳） | oss-cn-shenzhen |

其他配置保持默认即可。

## 第五步：启动项目

```bash
npm run dev
```

看到以下输出说明启动成功：
```
[后端] Server running on http://localhost:3000
[前端] Local: http://localhost:5173
```

打开浏览器访问：**http://localhost:5173**

---

## 🎮 使用指南

### 第一阶段：准备原画

**方式一：AI 生成**
1. 输入人物描述，如："身穿蓝色铠甲的女骑士，金色长发"
2. 点击"生成原画"
3. 等待 30-60 秒

**方式二：上传图片**
- 点击"上传图片"选择本地图片

确认满意后点击"确认使用此原画"。

### 第二阶段：编辑卡牌

1. **编辑文本框**：点击文本框，在右侧面板修改内容和底色
2. **输入背景提示词**：描述想要的背景风格
   - 示例："奇幻风格，星空背景，魔法光芒"
3. 点击"生成卡牌"

### 第三阶段：下载结果

生成完成后可下载 PNG 格式卡牌。

---

## 📜 可用脚本

| 脚本 | 说明 |
|------|------|
| `npm run install:all` | 安装所有依赖 |
| `npm run dev` | 开发模式启动 |
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产服务器 |

---

## ❓ 常见问题

### Q: 端口被占用
```
Error: listen EADDRINUSE: address already in use :::3000
```
**解决**：修改 `backend\.env` 中的 `PORT=3001`

### Q: 原画/背景生成失败
1. 检查 `DASHSCOPE_API_KEY` 是否正确
2. 确认阿里云账户有余额
3. 检查网络连接

### Q: OSS 上传失败
1. 确认 Bucket 权限为"公共读"
2. 检查 AccessKey 配置
3. 确认 Region 与 Bucket 地域匹配

### Q: 上传图片失败
- 确保图片小于 10MB
- 支持格式：JPG、PNG、WEBP

### Q: npm 命令无法识别
- 重新安装 Node.js
- 确保安装时勾选 "Add to PATH"

---

## 🔄 日常使用

以后每次使用只需：

```bash
cd GenCard
npm run dev
```

然后访问 http://localhost:5173

---

## 📄 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/generate/unified` | POST | 统一生成接口 |
| `/api/generate/v2` | POST | Qwen 模式生成 |
| `/api/upload` | POST | 上传图片 |
| `/api/health` | GET | 健康检查 |

---

## 🚀 未来计划

- [ ] 支持更多卡牌模板
- [ ] 批量生成功能
- [ ] 用户账户系统
- [ ] 云端存储历史记录
- [ ] 更多 AI 模型支持

---

## 📝 许可证

ISC License

---

## 🙏 致谢

- [React](https://react.dev/)
- [Fabric.js](http://fabricjs.com/)
- [Express](https://expressjs.com/)
- [Sharp](https://sharp.pixelplumbing.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [阿里云 DashScope](https://dashscope.console.aliyun.com/)

---

**注意**：使用 AI 服务会产生费用，请注意控制使用量。

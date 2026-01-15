# 迁移指南：从 DALL-E 到 Qwen-Image

本指南帮助您从旧的 DALL-E 3 生成系统平滑迁移到新的 ControlNet + Qwen-Image 系统。

## 概述

新系统提供了以下优势：
- ✅ 更好的布局控制（通过 ControlNet）
- ✅ 更好的上传图片支持
- ✅ 更精确的元素定位
- ✅ 更快的生成速度
- ✅ 更低的成本

## 迁移策略

### 方案 1：渐进式迁移（推荐）

使用统一端点，通过环境变量控制生成模式：

1. **保持现有客户端不变**
   - 旧客户端继续使用 `/api/generate`
   - 系统自动转换请求格式

2. **配置生成模式**
   ```bash
   # .env 文件
   GENERATION_MODE=qwen  # 或 'dalle'
   ```

3. **监控转换统计**
   ```bash
   GET /api/generate/conversion-stats
   ```

4. **逐步更新客户端**
   - 更新到新的请求格式（使用 `promptInput`）
   - 切换到 `/api/v2/generate` 端点

### 方案 2：直接切换

直接更新所有客户端到新系统：

1. **更新请求格式**

   
   旧格式：
   ```json
   {
     "layout": { ... },
     "prompt": "卡通风格的卡牌"
   }
   ```
   
   新格式：
   ```json
   {
     "layout": { ... },
     "promptInput": {
       "contentPrompt": "游戏角色卡牌",
       "stylePrompt": "卡通风格"
     }
   }
   ```

2. **更新端点**
   - 从 `/api/generate` 改为 `/api/v2/generate`

3. **配置 API 密钥**
   ```bash
   # .env 文件
   DASHSCOPE_API_KEY=your-dashscope-api-key-here
   GENERATION_MODE=qwen
   ```

## API 端点对比

### 旧端点（DALL-E）

```
POST /api/generate
GET  /api/generate/status
```

**特点：**
- ⚠️ 已弃用（但仍可用）
- 使用 DALL-E 3
- 单一 `prompt` 字段
- 响应头包含弃用警告

### 新端点（Qwen）

```
POST /api/v2/generate
GET  /api/v2/generate/status
```

**特点：**
- ✅ 推荐使用
- 使用 ControlNet + Qwen-Image
- 分离的 `contentPrompt` 和 `stylePrompt`
- 更好的布局控制

### 统一端点（自动路由）

```
POST /api/generate/unified
GET  /api/generate/unified/status
```

**特点：**
- 🔀 根据 `GENERATION_MODE` 自动路由
- 支持两种请求格式
- 便于 A/B 测试


## 环境变量配置

### DALL-E 模式

```bash
NODE_ENV=development
PORT=3000

# DALL-E 配置
OPENAI_API_KEY=sk-...
GENERATION_MODE=dalle
```

### Qwen 模式（推荐）

```bash
NODE_ENV=development
PORT=3000

# Qwen 配置
DASHSCOPE_API_KEY=sk-...
GENERATION_MODE=qwen

# ControlNet 配置
CONTROLNET_PREPROCESSOR=canny
CONTROLNET_SCALE=1.0
```

### 双模式支持（用于测试）

```bash
# 同时配置两个 API 密钥
OPENAI_API_KEY=sk-...
DASHSCOPE_API_KEY=sk-...

# 通过环境变量切换
GENERATION_MODE=qwen  # 或 'dalle'
```

## 请求格式转换

系统会自动转换旧格式到新格式：

### 自动转换规则

1. **单一 prompt → stylePrompt**
   ```
   prompt: "卡通风格" 
   → 
   promptInput: { contentPrompt: null, stylePrompt: "卡通风格" }
   ```

2. **上传图片合并**
   - 旧格式：`uploadedImages` 数组
   - 新格式：直接在 `layout.elements` 中

3. **弃用字段忽略**
   - `preserveBorders` 在新格式中始终为 true

### 监控转换

查看转换统计：
```bash
curl http://localhost:3000/api/generate/conversion-stats
```

响应示例：
```json
{
  "totalRequests": 100,
  "legacyRequests": 25,
  "newRequests": 75,
  "conversionRate": 25.0,
  "message": "Request format conversion statistics",
  "recommendation": "Legacy format requests detected..."
}
```


## 迁移检查清单

### 阶段 1：准备

- [ ] 配置 `DASHSCOPE_API_KEY`
- [ ] 设置 `GENERATION_MODE=qwen`
- [ ] 测试 `/api/v2/generate/status` 端点
- [ ] 验证 ControlNet 预处理器工作正常

### 阶段 2：测试

- [ ] 使用旧端点测试自动转换
- [ ] 检查 `/api/generate/conversion-stats`
- [ ] 使用新端点测试直接调用
- [ ] 对比生成结果质量

### 阶段 3：迁移客户端

- [ ] 更新前端代码使用新格式
- [ ] 更新 API 调用到 `/api/v2/generate`
- [ ] 测试所有功能
- [ ] 监控错误日志

### 阶段 4：清理

- [ ] 确认所有客户端已迁移
- [ ] 移除旧的 DALL-E 配置（可选）
- [ ] 更新文档
- [ ] 归档旧代码

## 回滚计划

如果需要回滚到 DALL-E：

1. **更新环境变量**
   ```bash
   GENERATION_MODE=dalle
   ```

2. **重启服务**
   ```bash
   npm run dev
   ```

3. **验证**
   ```bash
   curl http://localhost:3000/api/generate/unified/status
   ```

## 常见问题

### Q: 旧客户端是否需要立即更新？

A: 不需要。旧端点 `/api/generate` 仍然可用，系统会自动转换请求格式。

### Q: 如何在两种模式之间切换？

A: 修改 `.env` 文件中的 `GENERATION_MODE` 并重启服务。

### Q: 新系统是否支持所有旧功能？

A: 是的。新系统完全向后兼容，并提供了额外的功能。

### Q: 如何监控迁移进度？

A: 使用 `/api/generate/conversion-stats` 端点查看有多少请求仍在使用旧格式。

### Q: 性能有什么变化？

A: Qwen 模式通常更快，且成本更低。具体取决于您的配置。

## 技术支持

如有问题，请查看：
- 服务器日志中的警告和错误
- `/api/generate/unified/status` 端点的状态信息
- 转换统计数据

## 相关文档

- [ControlNet 预处理器配置](./CONTROLNET_PREPROCESSOR.md)
- [Qwen Generator 实现](./QWEN_GENERATOR_IMPLEMENTATION.md)
- [Prompt Builder 更新](./PROMPT_BUILDER_UPDATE.md)

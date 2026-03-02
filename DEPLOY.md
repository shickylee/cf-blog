# Cloudflare Workers 部署指南

**⚠️ 重要：本项目必须使用本地 wrangler 部署，不支持 Cloudflare Dashboard 的 GitHub 集成！**

## 为什么必须使用本地部署？

1. **配置保密**：`wrangler.jsonc` 和 `wrangler.toml` 包含敏感配置信息（database_id、KV namespace id 等），不应提交到 GitHub
2. **避免冲突**：使用本地部署可以避免 fork 用户的配置被作者更新覆盖
3. **灵活更新**：用户可以自主选择何时更新到最新版本，不会被强制更新
4. **最佳实践**：这是开源项目的推荐做法

---

## 部署步骤

### 1. 克隆项目

```bash
git clone https://github.com/gogcat/cf-blog.git
cd cf-blog
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 创建 Cloudflare 资源

如果还没有创建 Cloudflare 资源，需要先创建：

```bash
# 创建 D1 数据库
npx wrangler d1 create blog-db

# 创建 R2 存储桶
npx wrangler r2 bucket create blog-assets

# 创建 KV 命名空间
npx wrangler kv:namespace create CACHE
```

**记录返回的 ID**：
- D1 数据库 ID
- KV 命名空间 ID
- R2 存储桶名称

### 4. 配置 Wrangler

#### 4.1 复制示例配置文件

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

#### 4.2 编辑 `wrangler.jsonc`

将占位符替换为你的实际配置：

```jsonc
{
  "name": "cf-blog",
  "compatibility_date": "2026-03-01",
  "main": ".open-next/worker.js",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "blog-db",
      "database_id": "YOUR_D1_DATABASE_ID"  ← 替换为你的 D1 数据库 ID
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "YOUR_KV_NAMESPACE_ID"  ← 替换为你的 KV 命名空间 ID
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "blog-assets"  ← 替换为你的 R2 存储桶名称
    }
  ]
}
```

**⚠️ 重要：这些资源绑定 ID 必须修改！**

- `database_id` - 必须替换为你的 D1 数据库 ID
- `id` (KV namespace) - 必须替换为你的 KV 命名空间 ID
- `bucket_name` - 可以自定义，但必须在 Cloudflare 中创建对应的 R2 存储桶

### 5. 初始化数据库

```bash
# 本地开发
npx wrangler d1 execute blog-db --local --file=migrations/001_initial_schema.sql

# 生产环境
npx wrangler d1 execute blog-db --remote --file=migrations/001_initial_schema.sql
```

### 6. 配置环境变量

在 Cloudflare Dashboard 中配置环境变量：

1. 进入 **Workers & Pages** → **Workers**
2. 选择您的 Worker
3. 点击 **Settings** → **Variables and Secrets**
4. 添加以下环境变量：
   - `JWT_SECRET` - JWT 密钥（必需）
   - `SITE_URL` - 网站地址（必需）
   - `SITE_NAME` - 网站名称（必需）
   - `RESEND_API_KEY` - 邮件服务 API 密钥（可选）

**⚠️ 重要：环境变量不在 `wrangler.jsonc` 中设置，而是在 Cloudflare Dashboard 中配置！**

**原因**：`wrangler.jsonc` 中的 `vars` 会覆盖 Dashboard 中的环境变量设置，导致无法灵活修改。

### 7. 本地开发

```bash
pnpm dev
```

访问 http://localhost:3000

### 8. 构建项目

```bash
pnpm run build:workers
```

### 9. 部署到 Cloudflare Workers

```bash
npx wrangler deploy
```

或者使用 npm script：

```bash
pnpm deploy
```

**部署说明**：
- `build:workers` 命令会使用 OpenNext 构建 Next.js 应用
- `npx wrangler deploy` 会将构建产物部署到 Cloudflare Workers
- 部署成功后会显示 Worker URL，例如：`https://cf-blog.sticky-lee.workers.dev`
- `wrangler.jsonc` 中的 D1、KV、R2 绑定会自动应用到 Worker

---

## 配置自定义域名（可选）

在 Cloudflare Dashboard 中：

1. 进入 **Workers & Pages** → **Workers**
2. 选择您的 Worker
3. 点击 **Settings** → **Triggers**
4. 在 **Custom Domains** 部分点击 **Add Custom Domain**
5. 输入您的域名并按照提示配置 DNS

---

## 默认管理员账号

- 邮箱：`admin@example.com`
- 密码：`admin123`

**⚠️ 重要：首次登录后请立即修改密码！**

---

## 部署完成后

部署成功后，请测试以下功能：

1. ✅ 访问首页
2. ✅ 登录后台
3. ✅ 修改密码
4. ✅ 创建文章
5. ✅ 发布文章
6. ✅ 查看文章列表
7. ✅ 查看文章详情
8. ✅ 上传图片
9. ✅ 创建标签和分类

---

## 后续更新

当项目有更新时：

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 构建项目
pnpm run build:workers

# 3. 部署到 Cloudflare
npx wrangler deploy
```

---

## 常见问题

### Q: 部署失败怎么办？

A: 请检查：
1. `wrangler.jsonc` 中的资源绑定 ID 是否正确
2. 是否已登录 Wrangler：`npx wrangler login`
3. 构建是否成功：`pnpm run build:workers`
4. 网络连接是否正常

### Q: 如何查看部署日志？

A: 在本地终端中查看部署输出，或在 Cloudflare Dashboard 中：
1. 进入 **Workers & Pages** → **Workers**
2. 选择您的 Worker
3. 点击 **Logs** 标签

### Q: 如何回滚到之前的版本？

A: 使用 Git 回滚代码，然后重新部署：
```bash
# 查看历史提交
git log

# 回滚到指定版本
git checkout <commit-hash>

# 重新构建和部署
pnpm run build:workers
npx wrangler deploy
```

### Q: 为什么不能使用 Cloudflare Dashboard 的 GitHub 集成？

A: 因为：
1. `wrangler.jsonc` 不在 GitHub 中（包含敏感信息）
2. 自动部署会失败（缺少配置文件）
3. 本地部署更安全、更灵活

### Q: 如何断开 Cloudflare Dashboard 的 GitHub 集成？

A: 在 Cloudflare Dashboard 中：
1. 进入 **Workers & Pages** → **Workers**
2. 选择您的 Worker
3. 点击 **Settings** → **Sources**
4. 找到 GitHub 连接
5. 点击 **Disconnect** 或 **Remove** 按钮
6. 确认断开连接

---

## 联系方式

如有问题，请联系：
- GitHub: https://github.com/gogcat/cf-blog
- Email: i@lishiqi.cn

---

## 部署警告说明

部署时可能会看到以下警告，可以安全忽略：

```
WARN You've disabled incremental cache. This means that ISR and SSG will not work.
WARN You've disabled tag cache. This means that revalidatePath and revalidateTag from next/cache will not work.
```

这些警告是正常的，因为：
- Cloudflare Workers 是无服务器环境，不支持这些缓存功能
- 本项目使用动态渲染，不依赖这些功能
- 不影响项目的正常运行

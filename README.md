# CF-blog （Cloudflare Blog）

基于 Cloudflare 全家桶构建的现代化博客系统

A modern, serverless blog system built entirely on Cloudflare’s ecosystem

这是一个完全运行在 Cloudflare 生态上的开源博客程序，使用 Pages、Workers、D1 等服务实现，依托 Cloudflare 慷慨的免费额度即可稳定运行。
没有复杂环境、无需服务器、低成本、高可用、全球极速访问。
适合想零成本拥有独立博客，又不想折腾主机、运维的用户。

A clean, full-featured blog platform powered by Cloudflare Pages, Workers, and D1 Database. Runs completely free on Cloudflare’s generous free tier, with global edge acceleration, zero server maintenance, and no hosting costs.

## 亮点
- 纯 Cloudflare 原生架构，免费额度就能跑满性能
- 全球边缘节点加速，访问速度快、稳定性强
- 无需数据库服务器、无需域名备案、无需运维
- 界面简洁，文章管理方便，适合长期使用

## 功能特性

- **文章管理** - Markdown 文章发布、编辑、分类、标签
- **评论系统** - 访客评论、回复、审核机制
- **用户系统** - 注册登录、角色权限（用户/作者/管理员）
- **后台管理** - 文章、评论、用户、分类、标签、系统设置
- **图片存储** - Cloudflare R2 对象存储
- **响应式设计** - 移动端适配

## 技术栈

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Cloudflare Workers (通过 OpenNext)
- Cloudflare D1 (SQLite)
- Cloudflare R2
- Cloudflare KV (缓存)

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/gogcat/cf-blog.git
cd cf-blog
pnpm install
```

### 2. 配置 Cloudflare

```bash
# 登录
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create blog-db

# 创建 R2 存储储桶
npx wrangler r2 bucket create blog-assets

# 创建 KV 命名空间（用于缓存）
npx wrangler kv:namespace create CACHE
```

### 3. 更新配置

**⚠️ 重要：本项目包含 `wrangler.jsonc`（作者配置）和 `wrangler.jsonc.example`（示例配置）**

**对于 fork 用户**：
1. 复制 `wrangler.jsonc.example` 为 `wrangler.jsonc`
2. 修改 `wrangler.jsonc` 中的资源绑定 ID

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

编辑 `wrangler.jsonc`，替换相关 ID：

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "blog-db",
      "database_id": "your-database-id"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "your-kv-namespace-id"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "blog-assets"
    }
  ]
}
```

**⚠️ 重要：这些资源绑定 ID 必须修改！**

- `database_id` - 必须替换为你的 D1 数据库 ID
- `id` (KV namespace) - 必须替换为你的 KV 命名空间 ID
- `bucket_name` - 可以自定义，但必须在 Cloudflare 中创建对应的 R2 存储桶

**环境变量配置**：

环境变量（`SITE_URL`、`SITE_NAME` 等）**不在 `wrangler.jsonc` 中设置**，而是在 Cloudflare Dashboard 中配置。

**原因**：`wrangler.jsonc` 中的 `vars` 会覆盖 Dashboard 中的环境变量设置，导致无法灵活修改。

### 4. 初始化数据库

```bash
# 本地
npx wrangler d1 execute blog-db --local --file=migrations/001_initial_schema.sql

# 生产环境
npx wrangler d1 execute blog-db --remote --file=migrations/001_initial_schema.sql
```

### 5. 本地开发

```bash
pnpm dev
```

访问 http://localhost:3000

### 6. 部署到 Cloudflare Workers

**⚠️ 重要：本项目是 Cloudflare Workers 项目，不是 Cloudflare Pages 项目！**

#### 部署步骤：

```bash
# 1. 构建项目
pnpm run build:workers

# 2. 部署到 Cloudflare Workers
npx wrangler deploy
```

或者使用 npm script：

```bash
pnpm deploy
```

#### 部署说明：

- `build:workers` 命令会使用 OpenNext 构建 Next.js 应用
- `npx wrangler deploy` 会将构建产物部署到 Cloudflare Workers
- 部署成功后会显示 Worker URL，例如：`https://cf-blog.sticky-lee.workers.dev`
- `wrangler.jsonc` 中的 D1、KV、R2 绑定会自动应用到 Worker

#### 不要使用以下命令（错误）：

```bash
# ❌ 错误：不要使用 pages deploy
npx wrangler pages deploy .open-next --project-name=cf-blog
```

这是 Cloudflare Pages 的部署命令，不适用于本项目！

### 7. 配置环境变量

在 Cloudflare Dashboard 中配置环境变量：

1. 进入 **Workers & Pages** → **Workers**
2. 选择您的 Worker
3. 点击 **Settings** → **Variables and Secrets**
4. 添加以下环境变量：
   - `JWT_SECRET` - JWT 密钥（必需）
   - `SITE_URL` - 网站地址（必需）
   - `SITE_NAME` - 网站名称（必需）
   - `RESEND_API_KEY` - 邮件服务 API 密钥（可选）

### 8. 配置自定义域名（可选）

在 Cloudflare Dashboard 中：

1. 进入 **Workers & Pages** → **Workers**
2. 选择您的 Worker
3. 点击 **Settings** → **Triggers**
4. 在 **Custom Domains** 部分点击 **Add Custom Domain**
5. 输入您的域名并按照提示配置 DNS

## 默认管理员账号

- 邮箱：`admin@example.com`
- 密码：`admin123`

**⚠️ 重要：首次登录后请立即修改密码！**
```

## 默认管理员

| 邮箱 | 密码 |
|------|------|
| admin@example.com | admin123 |

> 部署后请及时修改密码！

## 项目结构

```
├── migrations/          # 数据库迁移
├── public/             # 静态资源
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── (admin)/    # 后台管理
│   │   ├── (frontend)/ # 前台页面
│   │   └── api/        # API 路由
│   ├── components/     # 组件
│   └── lib/           # 工具函数
├── open-next.config.ts # OpenNext 配置
└── wrangler.jsonc      # Cloudflare Workers 配置
```

## 环境变量

参考 `.env.example` 配置必要的环境变量。

在 Cloudflare Dashboard 中设置环境变量（Settings > Variables）。

## 联系

如有问题或建议，欢迎通过邮箱联系我们：i@lishiqi.cn

## License

MIT License - see [LICENSE](LICENSE) file for details.

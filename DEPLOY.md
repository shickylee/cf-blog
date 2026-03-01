# Cloudflare Workers 部署指南

由于本地 wrangler 命令遇到权限限制，请通过 Cloudflare Dashboard 部署。

## 部署步骤

### 1. 登录 Cloudflare Dashboard

访问：https://dash.cloudflare.com

### 2. 进入 Workers & Pages

- 点击左侧菜单 **Workers & Pages**
- 点击 **Workers** 标签

### 3. 选择 cf-blog Worker

找到并点击 **cf-blog** Worker

### 4. 配置 GitHub 集成

#### 方法 A：使用 Cloudflare Workers（推荐）

**重要：本项目是 Cloudflare Workers 项目，不是 Pages 项目！**

1. 点击 **Settings** 标签
2. 点击 **Sources**
3. 点击 **Connect to Git**
4. 选择 **GitHub**
5. 授权 Cloudflare 访问您的仓库
6. 选择 `gogcat/cf-blog` 仓库
7. 选择 `main` 分支
8. 配置构建设置：
   - **Build command**: `pnpm run build:workers`
   - **Build output directory**: `.open-next`
9. 点击 **Save and Deploy**

Cloudflare 会自动：
- 拉取最新代码
- 构建项目
- 部署到 Workers

#### 方法 B：使用 Cloudflare Pages（备选）

如果 Workers 部署不可用，可以使用 Pages：

1. 进入 **Workers & Pages** → **Pages**
2. 点击 **Create application**
3. 点击 **Connect to Git**
4. 选择 **GitHub**
5. 选择 `gogcat/cf-blog` 仓库
6. 配置构建设置：
   - **Project name**: `cf-blog-pages`
   - **Production branch**: `main`
   - **Framework preset**: `None`
   - **Build command**: `pnpm run build:workers`
   - **Build output directory**: `.open-next`
   - **Root directory**: `/`
7. 点击 **Save and Deploy**

#### 方法 C：手动上传（如果 GitHub 集成不可用）

1. 点击 **Settings** 标签
2. 点击 **Sources**
3. 点击 **Upload**
4. 上传 `.open-next` 文件夹
5. 点击 **Deploy**

### 5. 验证部署

部署成功后，访问：
```
https://cf-blog.sticky-lee.workers.dev
```

## 测试密码修改功能

1. 访问设置页面：
   ```
   https://cf-blog.sticky-lee.workers.dev/admin/settings
   ```

2. 修改密码：
   - 当前密码：`admin123`
   - 新密码：选择强密码（例如：`K9#mP2$vL5@xN8!`）

3. 验证成功：
   - 如果修改成功，说明问题已解决
   - 可以用新密码重新登录

## 本地部署命令（供参考）

如果需要本地部署，可以使用以下命令：

```bash
# 构建项目
pnpm run build:workers

# 部署到 Cloudflare Workers
npx wrangler deploy --config wrangler.jsonc
```

注意：本地部署可能遇到权限问题，建议使用 Cloudflare Dashboard 部署。

## 部署完成后

部署成功后，请测试以下功能：

1. ✅ 访问首页
2. ✅ 登录后台
3. ✅ 修改密码
4. ✅ 创建文章
5. ✅ 发布文章
6. ✅ 查看文章列表
7. ✅ 查看文章详情

## 常见问题

### Q: 部署失败怎么办？

A: 请检查：
1. GitHub 仓库是否正确连接
2. 构建日志是否有错误
3. D1、KV、R2 绑定是否正确配置

### Q: 如何查看部署日志？

A: 在 Cloudflare Dashboard 中：
1. 进入 **Workers & Pages** → **Workers**
2. 选择 **cf-blog** Worker
3. 点击 **Logs** 标签

### Q: 如何回滚到之前的版本？

A: 在 Cloudflare Dashboard 中：
1. 进入 **Workers & Pages** → **Workers**
2. 选择 **cf-blog** Worker
3. 点击 **Deployments**
4. 选择之前的版本并点击 **Rollback**

## 联系方式

如有问题，请联系：
- GitHub: https://github.com/gogcat/cf-blog
- Email: your-email@example.com

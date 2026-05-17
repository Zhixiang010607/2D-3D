# 云端账号部署说明

这个项目的员工账号已经改成通过 Cloudflare Workers + D1 统一保存。这样管理员创建的员工账号可以在不同电脑、不同浏览器里登录。

## 需要准备

- 一个 Cloudflare 账号
- 已安装 Node.js
- 本项目仓库

## 1. 创建 D1 数据库

```bash
cd worker
npx wrangler d1 create yyj-renderer-auth
```

把命令返回的 `database_id` 填进 `worker/wrangler.toml`。

可以从示例文件复制：

```bash
copy wrangler.toml.example wrangler.toml
```

## 2. 初始化数据库表

```bash
npx wrangler d1 execute yyj-renderer-auth --file=./schema.sql --remote
```

## 3. 设置管理员和登录密钥

```bash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

建议值：

- `ADMIN_USERNAME`: `yanyujie123`
- `ADMIN_PASSWORD`: `123456789`
- `SESSION_SECRET`: 随机长字符串，至少 24 个字符

## 4. 部署 Worker API

```bash
npx wrangler deploy
```

部署完成后会得到一个 Worker 地址，例如：

```text
https://yyj-renderer-auth.your-name.workers.dev
```

## 5. 连接前端

打开 `index.html`，把：

```html
window.YYJ_AUTH_API_URL = "";
```

改成你的 Worker 地址：

```html
window.YYJ_AUTH_API_URL = "https://yyj-renderer-auth.your-name.workers.dev";
```

如果以后前端和 Worker 部署在同一个域名，并且 `/api/...` 能直接转到 Worker，这里可以继续留空。

## 注意

- 员工密码不会明文保存在数据库里，只保存加密后的密码。
- 管理员可以重置员工密码，但不能查看员工旧密码。
- 前端的“记住密码”只保存在当前浏览器，用于自动填表。

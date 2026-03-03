# 水泥花格地图（本地副本）

本仓库包含已上线站点 `http://111.230.204.154/` 的前端静态文件本地副本，便于后续通过 Git 进行版本管理与部署。

## 包含内容
- `website/index.html`：地图主页（Leaflet + 高德瓦片）
- `website/upload.html`：上传页面（调用腾讯地图地理编码 JSONP、提交到 `/api/works`）
- `website/logo.svg`：站点徽标

说明：
- 页面依赖的地图与地理编码均走外部服务（unpkg、腾讯地图 API、高德瓦片），不需要本地安装。
- 数据接口 `/api/works` 与上传接口是后端服务，不在本仓库内。若要完整运行上传与数据展示功能，请准备相应后端并允许跨域或同源访问。

## 本地预览
在项目根目录启动一个静态服务器（任选其一）：

```bash
# Python 3
python3 -m http.server 8080 -d website

# 或者 Node (若已安装 http-server)
npx http-server website -p 8080
```

然后打开浏览器访问：
http://localhost:8080/

提示：
- 若没有后端，地图会加载但 `/api/works` 请求会失败；可临时将 `index.html` 中 `fetch('/api/works')` 替换为本地 JSON 文件以调试前端。

## 通过 Git 部署（示例）
1. 初始化仓库（首次）：
   ```bash
   git init
   git branch -M main
   ```
2. 添加远程并推送：
   ```bash
   git remote add origin <你的远程仓库地址>
   git add .
   git commit -m "Init: import static website"
   git push -u origin main
   ```
3. 托管方式示例：
   - GitHub Pages / Vercel / Netlify：将 `website/` 作为站点根目录
   - Nginx / 静态服务器：配置站点根目录为 `website/`
   - 注意将后端接口 `/api/works` 指向你的后端服务地址（反向代理或同一域名）

## 结构
```
website/
├─ index.html      # 地图主页（从 /api/works 拉取作品）
├─ upload.html     # 上传页面（提交到 /api/works）
└─ logo.svg        # 站点徽标
```

## 后续建议
- 将后端服务代码纳入同一 Git 项目（如 `server/` 目录），统一版本管理与部署
- 为生产域名设置反向代理到后端（或在同一域名下提供 `/api`）
- 在前端加入 `.env`/配置文件方式管理 API 基础地址


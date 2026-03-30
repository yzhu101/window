# 水泥花格地图 (Window Map) 架构图

以下展示了当前线上系统的架构，包括域名解析、Nginx 反向代理、后端服务与数据存储的关系。

```mermaid
graph TB
    subgraph Client [用户端 (Browser/Mobile)]
        User((User))
        User -->|HTTPS Request| Domain[windowmap.xyz]
    end

    subgraph Server [云服务器 (Ubuntu @ 111.230.204.154)]
        
        subgraph WebServer [Nginx (Port 80/443)]
            Nginx[Nginx Web Server]
            
            %% 路由规则
            Nginx -->|/ (Static Files)| Static[静态前端文件]
            Nginx -->|/api/* (Proxy)| BackendPort[Port 3000]
        end

        subgraph Frontend [前端资源 (Static Hosting)]
            Static --> HTML[HTML/CSS/JS]
            Static --> Assets[图片资源 /uploads]
            
            note1[pokedex.html<br>index.html<br>admin.html]
            HTML -.-> note1
        end

        subgraph Backend [后端服务 (Node.js/Express)]
            BackendPort --> ExpressApp[huage-server (PM2 Managed)]
            
            ExpressApp -->|Read/Write| Mongo[MongoDB Database]
            ExpressApp -->|Sync/Backup| JSON[本地 JSON 文件]
            
            %% 业务逻辑
            ExpressApp -- 鉴权 --> AdminAuth[管理员认证]
            ExpressApp -- 图鉴管理 --> PokedexAPI[图鉴 API]
            ExpressApp -- 地图数据 --> WorksAPI[花窗数据 API]
        end

        subgraph Storage [数据存储]
            Mongo -- 存储 --> WorksData[(花窗作品数据)]
            Mongo -- 存储 --> PokedexData[(图鉴分类数据)]
            JSON -- 备份 --> LocalFiles[pokedex.json<br>pokedex-config.json]
            
            %% 之前的同步逻辑
            PokedexData <.-> LocalFiles
        end
    end

    %% 样式
    style Domain fill:#f9f,stroke:#333,stroke-width:2px
    style Nginx fill:#bbf,stroke:#333,stroke-width:2px
    style ExpressApp fill:#bfb,stroke:#333,stroke-width:2px
    style Mongo fill:#ff9,stroke:#333,stroke-width:2px
```

## 架构说明

1.  **访问入口 (Entry Point)**
    -   用户访问 `windowmap.xyz`。
    -   DNS 解析指向服务器 IP `111.230.204.154`。
    -   请求首先到达 **Nginx** (监听 80/443 端口)。

2.  **流量分发 (Routing)**
    -   **静态资源**: 访问页面（如 `/`, `/pokedex.html`）或图片时，Nginx 直接从 `/var/www/window/website` 目录读取文件返回，速度最快。
    -   **API 请求**: 访问 `/api/*`（如获取图鉴列表、上传图片）时，Nginx 将请求转发（反向代理）给内部运行的 **Node.js 服务** (端口 3000)。

3.  **后端服务 (Backend)**
    -   运行环境：Node.js + Express。
    -   进程管理：使用 **PM2** (`huage-server`) 保持服务常驻，崩溃自动重启。
    -   功能：处理业务逻辑、权限验证、图片上传处理。

4.  **数据存储 (Data)**
    -   **MongoDB**: 主要数据库，存储所有花窗地点数据 (`Works`) 和图鉴数据 (`Pokedex`)。
    -   **JSON 文件**: `pokedex.json` 和 `config` 文件作为配置和备份存在。后端现在的逻辑是 **双向同步**：写入数据库的同时也会更新本地文件，确保数据安全。
    -   **文件系统**: 上传的图片存储在服务器的 `/uploads` 文件夹中，由 Nginx 直接提供访问。

# 摸鱼派（FishPi）聊天室 for DSH

把 [摸鱼派 / FishPi](https://fishpi.cn) 在线聊天室放进 DeepSeek Harness 的右侧边栏，并在 DSH 设置中登录鱼排账号。

- npm：<https://www.npmjs.com/package/@iwpz/fishpi-dsh>
- GitHub：<https://github.com/FishPiOffical/fishpi-dsh>
- 包名：`@iwpz/fishpi-dsh`
- 当前版本：`0.1.0`

![FishPi chatroom preview](docs/preview.svg)

## 功能

### 聊天室

- 右侧边栏标签页：从边栏 `+` 指南卡片打开「摸鱼派聊天室」，或点会话标题栏的鱼形按钮。
- 最近消息 + 上拉加载历史；实时接收新消息、编辑、撤回和连接状态变化。
- 显示当前话题、在线人数、连接状态和未读数量。
- 发送 Markdown；自己的消息靠右显示。
- 输入框自动增高，不显示垂直滚动条；发送按钮在输入框右侧。
- 输入框左侧 `+` 可选择多张图片，支持直接粘贴剪贴板图片；上传后插入 Markdown 图片。
- 富文本模式渲染鱼排清洗后的 Markdown / 图片 / 链接；纯文本模式只显示文字，图片显示为 `[图片]` / `[Image]`。
- 链接在外部浏览器打开。

### 红包

- 红包卡片标题显示类型：拼手气、普通、专属、心跳、猜拳。
- 点击红包打开领取明细和领取入口。
- 普通/拼手气/专属/心跳：勾选确认后可直接点卡片领取。
- 猜拳红包：卡片上直接显示 `[石] [剪] [布]`，点击即按对应出拳领取，不需要额外勾选。
- 已领取或已抢完的猜拳红包不再显示出拳按钮。
- 弹窗中的领取明细保持中立，不额外显示个人账目。

### @ 提及

- 输入 `@` 弹出用户候选。
- 在线用户按用户名/昵称模糊匹配，其他用户通过鱼排用户名联想接口搜索。
- 支持 `↑` / `↓` 选择，`Enter` / `Tab` 确认，`Esc` 关闭，也可以鼠标点击。
- 选中后插入 `@用户名 `，鱼排服务端会发出真正的提及通知。

### 用户资料与勋章

- 消息头像、昵称/用户名，红包领取记录里的头像和名字，红包发送者，都可以点击打开资料卡。
- 资料卡显示头像、`昵称(用户名)`、角色、编号、位置（资料公开时）、积分、累计在线时长、简介。
- 「主页」按钮直接打开 `https://fishpi.cn/member/<用户名>`。
- 勋章在资料卡中显示完整图标 + 名称 + 描述。
- 聊天窗口昵称后方显示 14px 勋章图标微缩版，悬停可看名称和描述。

### 通知与外观

- 未读标记显示在标签标题和会话标题栏鱼形按钮上。
- 可选桌面通知；聊天室不在前台时提醒新消息，点击通知可打开聊天室。
- 设置项图标、会话入口和侧栏指南卡片播放鱼排首页 `#logo-animate` 的猫咪 + 鱼动画；插件管理器图标为同一动画生成的动态 WebP。
- 跟随 DSH 浅色/深色主题。

## 安装

插件同时发布在 npm、GitHub 和 GitHub 源码压缩包中。任选一种方式即可，不需要构建步骤。

### 方式一：npm（推荐）

1. 打开 DSH 的 **Plugins** 页面。
2. 点 **Add plugin**，输入：
   ```
   @iwpz/fishpi-dsh
   ```
   或指定版本：
   ```
   @iwpz/fishpi-dsh@0.1.0
   ```
3. 安装后启用插件，刷新页面。

npm 页面：<https://www.npmjs.com/package/@iwpz/fishpi-dsh>

### 方式二：GitHub

直接通过 Git 地址安装（当前 DSH 版本的 Add plugin 接受 Git spec 时）：

1. **Plugins → Add plugin**，输入：
   ```
   git+https://github.com/FishPiOffical/fishpi-dsh.git
   ```
2. 启用并刷新页面。

如果当前版本只接受本地目录，克隆后选择目录：

```sh
git clone https://github.com/FishPiOffical/fishpi-dsh.git
```

然后在 **Plugins → Add plugin** 中选择克隆下来的 `fishpi-dsh` 文件夹。

### 方式三：ZIP

1. 下载 GitHub 源码压缩包：
   <https://github.com/FishPiOffical/fishpi-dsh/archive/refs/heads/main.zip>
   （也可以打开 GitHub 仓库，Code → Download ZIP。）
2. 解压，得到 `fishpi-dsh-main` 文件夹。
3. DSH **Plugins → Add plugin** → 选择解压后的文件夹。
4. 启用插件并刷新页面。

GitHub 生成的 ZIP 不包含 `.git`；仓库里的测试和 `refs/API-v3.md` 参考文档会一并包含。

### 从本地目录安装（开发）

如果已经在本机 checkout：

1. **Plugins → Add plugin**。
2. 选择本仓库目录（包含 `package.json` 和 `cordis.patch.yml`）。
3. 启用插件。

## 登录与使用

1. 打开 **Settings → 摸鱼派**。
2. 输入鱼排用户名或邮箱、密码；两步验证码输入框会一直显示，未开启两步验证时留空即可。
3. 勾选「记住密码」时，密码的 MD5 摘要会保存在 DSH 凭据库，用于访问令牌过期后自动重新登录；两步验证账号仍需手动输入验证码。
4. 还没有账号可以点登录表单里的「去注册」，跳转鱼排注册页。
5. 从会话标题栏鱼形按钮或右侧边栏 `+` 指南卡片打开聊天室。
6. 在设置中选择富文本/纯文本，以及是否启用桌面通知。

## 凭据与数据

- 访问令牌和可选的密码摘要保存在本机 DSH 凭据库的记录 `fishpi-chat/account` 中，不写入 `cordis.patch.yml`，也不放进 localStorage。
- 页面只通过 DSH 同源的 `api/fishpi/*` 认证路由访问 Host；密码和 token 不会进入页面。
- 鱼排登录由 DSH Host 发起；聊天室 WebSocket 也由 Host 维持，页面不直接调用鱼排 API。
- 富文本中的图片由页面从鱼排图床加载。
- 退出登录会删除凭据记录。

## 限制

- 鱼排登录接口不允许浏览器跨域，因此登录必须在 Host 完成。
- 两步验证账号的访问令牌过期后，需要重新输入密码和验证码。
- 聊天室必须在有会话的情况下使用；没有活动会话时没有右侧边栏入口。
- 暂不支持表态（reactions）、撤回、弹幕和修改话题。
- 图片直接从鱼排图床加载；默认不做模糊处理。
- 插件基于 [鱼排 API v3](https://github.com/FishPiOffical/rhythm/blob/api_v3/API.md)，第三方行为可能与第一方网页不同。

## 卸载

在 **Plugins** 中移除或停用 `@iwpz/fishpi-dsh`，然后刷新页面。凭据记录不会随插件移除自动删除；需要彻底清理时请在 DSH 凭据管理中删除 `fishpi-chat/account`。

## 开发

没有构建步骤：

- `index.js`：Host 路由、登录、凭据、WebSocket 生命周期。
- `fishpi.js`：FishPi HTTP / WebSocket 客户端。
- `client.js`：浏览器模块，注册右侧边栏、设置页、会话按钮、用户资料和红包界面。
- `locale/en.json`、`locale/zh.json`：插件管理器展示元数据。
- `test/`：Node 测试。

运行测试：

```sh
node --test test/fishpi.test.mjs test/host.test.mjs test/client.test.mjs
```

检查 npm 打包内容：

```sh
npm pack --dry-run
```

## 致谢与声明

- 鱼排 Logo 与 `#logo-animate` 动画来自 [fishpi.cn](https://fishpi.cn)；公开分发/再发布前请确认鱼排的品牌与素材授权。

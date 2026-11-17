# FishPi chatroom for DSH

Adds a [FishPi / 摸鱼派](https://fishpi.cn) chatroom to the DeepSeek Harness right
Sidebar, with account sign-in in DSH Settings.

![FishPi chatroom preview](docs/preview.svg)

## What it does

- **Right Sidebar tab** — open it from the right Sidebar's `+` guide card
  (**FishPi chatroom**) or from the fish button in a Session header. The tab
  shows recent messages, live updates, topic, online count, and a composer.
- **Settings → FishPi** — sign in with username/email and password; accounts
  with two-step verification are asked for the code. Sign out from the same page.
- **Message rendering** — rich text renders the server-sanitized HTML (Markdown,
  links, images) stored by FishPi; plain text shows the source text only and
  replaces image syntax with a localized `[Image]` / `[图片]` label. Links open
  outside the panel.
- **Cards** — red packet, music, and weather messages render as compact cards.
  Clicking a red packet opens its claim records and a claim action; heartbeat
  and rock-paper-scissors packets require explicit risk acceptance, and
  rock-paper-scissors also asks for a gesture.
- **Images** — the composer's `+` button selects several images at once, and
  pasted images are accepted too. Files upload through the Host and are inserted
  into the message as Markdown image links; the send button sits to the right of
  the input.
- **Mentions** — typing `@` opens a username candidate popup. Online users are
  matched fuzzily by username or nickname, and FishPi's suggestion API supplies
  username-prefix matches. Choosing a candidate inserts `@username `, which the
  FishPi server turns into a real mention notification.
- **Own messages** — messages you sent align to the right side of the panel.
- **Animated mark** — the Settings entry, the Session-header button, and the
  Sidebar guide card replay the FishPi home-page `#logo-animate` composition;
  the Plugin Manager icon is an animated WebP rendered from the same data.
- **Unread and notifications** — the header fish button shows a dot and the tab
  title carries the unread count; optional desktop notifications fire while the
  chatroom is not in front.
- **Live transport** — the Host keeps one authenticated FishPi chat WebSocket,
  refreshes its ticket before the grant expires, reconnects with backoff, and
  replays events to the page; the page re-reads the message window whenever the
  server asks for a resync.

## Install

From the DSH **Plugins** page choose **Add plugin** and select this directory.
The bundle is local and private; it has no npm dependencies.

## Use

1. Open **Settings → FishPi**.
2. Enter your FishPi username or email and password, then **Sign in**.
   With **Remember password** on, the password's MD5 digest is stored so an
   expired access token can sign in again automatically.
3. Open the chat from the Session header's fish button or the right Sidebar's
   `+` guide card.
4. Pick **Rich text** or **Plain text** and enable **Desktop notifications** in
   Settings. The login form also links to the FishPi registration page.

## Where credentials live

The access token and the optional password digest are stored as a credential
record (`fishpi-chat/account`) in the local DSH credential store — not in the
profile's `cordis.patch.yml`, not in localStorage, and never sent to the page.
The page talks to the Host only through authenticated same-origin
`api/fishpi/*` routes and never calls the FishPi API itself. Rich-text images
are loaded by the page from FishPi's image hosts. Signing out deletes the
record.

## Limitations

- FishPi's login endpoint refuses browser CORS, so the Host performs login; the
  page never contacts `fishpi.cn` directly.
- Accounts with two-step verification cannot renew from the saved password
  digest alone: when the access token expires, sign in again with the password
  and the code.
- The chat opens inside a Session; without an active conversation there is no
  right Sidebar to open it into.
- Reactions, message withdrawal, barrages, and changing the topic are not part
  of this version.
- Images load from FishPi's image hosts; the panel blurs nothing by default.
- The plugin uses FishPi API v3 as documented at
  <https://github.com/FishPiOffical/rhythm/blob/api_v3/API.md>; third-party
  behavior can differ from the first-party website.

## Development

The package has no build step:

- `index.js` — Host wiring and routes; `fishpi.js` — FishPi HTTP/WebSocket client.
- `client.js` — the browser module (`window.__ModuleLoader__` factory).
- `locale/en.json`, `locale/zh.json` — Plugin Manager display metadata.
- `test/fishpi.test.mjs` — Node tests for the API client, event hub, and message
  normalization (`node --test test/fishpi.test.mjs`).

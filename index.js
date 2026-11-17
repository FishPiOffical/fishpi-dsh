/**
 * Host half of the FishPi chat plugin.
 *
 * Responsibilities:
 * - Log in on the Host (the FishPi login endpoint refuses browser CORS), keep
 *   the access token and an optional password digest in the DSH credential
 *   store, and renew the session when it expires.
 * - Keep one chat WebSocket open per DSH process and fan its events out as a
 *   replayable, cursor-based event log.
 * - Serve the browser through authenticated same-origin Fetch routes, so no
 *   secret and no cross-origin request ever reaches the page.
 */

import {
  ChatRealtime,
  DEFAULT_SITE,
  delay,
  EventHub,
  FishPiApi,
  FishPiError,
  MAX_MESSAGE_LENGTH,
  md5Hex,
  normalizeMe,
  normalizeMessage,
} from './fishpi.js'

/** Credential record address: `<scope>/<id>`, both lowercase hyphenated. */
const CREDENTIAL_KEY = 'fishpi-chat/account'

/** Route prefix on DSH's authenticated API channel. */
const API_PREFIX = '/api/fishpi'

/** Longest a browser event request is held before an empty answer. */
const EVENT_WAIT_MS = 20_000

/** Retained realtime events; the browser reloads its window on a gap. */
const EVENT_LOG_LIMIT = 500

/** Cordis Host services this plugin needs. */
export const inject = ['connection', 'credentials']

/**
 * @param {unknown} value - candidate integer.
 * @param {number} fallback - used when the value is absent or unusable.
 * @param {number} min - lower bound.
 * @param {number} max - upper bound.
 * @returns {number}
 */
function integer(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/**
 * @param {unknown} value - candidate string.
 * @param {number} max - maximum accepted UTF-16 length.
 * @returns {string}
 */
function text(value, max) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/**
 * @param {Request} request - a buffered Fetch request.
 * @returns {Promise<Record<string, unknown>>} its JSON object body.
 */
async function readJson(request) {
  const body = await request.text()
  if (body.length > 16_384) throw new FishPiError('请求内容过大', { code: 'bad_request', status: 413 })
  if (body.trim() === '') return {}
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new FishPiError('请求格式不正确', { code: 'bad_request', status: 400 })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FishPiError('请求格式不正确', { code: 'bad_request', status: 400 })
  }
  return parsed
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - host context; its logger is optional.
 * @param {string} message - diagnostic text.
 * @param {unknown} error - the contained failure.
 */
function warn(ctx, message, error) {
  const line = `[fishpi-chat] ${message}`
  if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(line, error)
  else console.warn(line, error)
}

/**
 * Normalize the legacy medal list into icon-bearing records.
 * @param {unknown} data - medal envelope data or a list.
 * @returns {Array<{id: string, name: string, type: string, description: string, url: string, order: number}>}
 */
function normalizeMedals(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : []
  return list
    .filter(medal => medal !== null && typeof medal === 'object' && medal.enabled !== false)
    .map(medal => {
      const attr = typeof medal.attr === 'string' ? medal.attr : ''
      let url = ''
      try {
        url = new URLSearchParams(attr).get('url') ?? ''
      } catch {
        url = ''
      }
      if (url === '') return null
      return {
        id: medal.id === undefined ? '' : String(medal.id),
        name: typeof medal.name === 'string' ? medal.name : '',
        type: typeof medal.type === 'string' ? medal.type : '',
        description: typeof medal.description === 'string' ? medal.description : '',
        url,
        order: Number(medal.order) || 0,
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order)
}

/**
 * @param {unknown} data - JSON-safe body.
 * @param {number} [status] - HTTP status.
 * @returns {Response}
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * @param {unknown} error - a thrown operation failure.
 * @returns {Response}
 */
function failure(error) {
  const known = error instanceof FishPiError
    ? error
    : new FishPiError(error instanceof Error ? error.message : '操作失败', { code: 'internal' })
  const status = known.status >= 400 && known.status < 600 ? known.status : 500
  return json({ ok: false, code: known.code, message: known.message }, status)
}

/**
 * Owns the FishPi session and translates browser requests into API calls.
 */
class FishPiChat {
  /**
   * @param {{ ctx: import('@deepseek-ai/cordis').Context, hub: EventHub }} options - Host context and event log.
   */
  constructor(options) {
    this.ctx = options.ctx
    this.hub = options.hub
    this.api = new FishPiApi({ siteUrl: DEFAULT_SITE })
    this.stopped = false
    this.initialized = false
    this.loggedIn = false
    this.user = undefined
    /** @type {Record<string, any>|undefined} */
    this.record = undefined
    this.tokenExpiresAt = 0
    /** @type {'connecting'|'connected'|'disconnected'} */
    this.connectionState = 'disconnected'
    /** @type {FishPiError|undefined} */
    this.lastError = undefined
    /** @type {ChatRealtime|undefined} */
    this.realtime = undefined
    /** @type {Promise<void>|undefined} */
    this.loginTask = undefined
    /** @type {Map<string, { at: number, medals: object[] }>} */
    this.medalCache = new Map()
  }

  /** Load stored credentials, validate the token, and start the socket. */
  async initialize() {
    try {
      const stored = await this.ctx.credentials.readRecord(CREDENTIAL_KEY)
      if (stored?.kind === 'grant' && stored.payload !== null && typeof stored.payload === 'object') {
        this.record = /** @type {Record<string, any>} */ (stored.payload)
      }
    } catch (error) {
      warn(this.ctx, 'could not read stored credentials', error)
    }

    if (this.record?.accessToken) {
      this.api.setToken(String(this.record.accessToken))
      this.tokenExpiresAt = Number(this.record.tokenExpiresAt) || 0
      try {
        const me = await this.api.me()
        this.user = normalizeMe(me)
        this.loggedIn = this.user !== undefined
      } catch (error) {
        const authFailure = error instanceof FishPiError
          && (error.status === 401 || error.status === 403 || error.code === 'unauthorized')
        if (authFailure) {
          this.api.setToken('')
          this.user = undefined
          this.loggedIn = false
        } else {
          this.#rememberFailure(error)
        }
      }
    }

    if (!this.loggedIn && this.record?.passwordMd5) {
      try {
        await this.#loginWithDigest(String(this.record.nameOrEmail ?? ''), String(this.record.passwordMd5), this.record.remember !== false)
      } catch (error) {
        this.#rememberFailure(error)
      }
    }

    this.initialized = true
    if (this.loggedIn && this.realtime === undefined) this.#startRealtime()
    this.#emitState()
  }

  /** Release the socket and every held event request. */
  dispose() {
    this.stopped = true
    this.realtime?.stop()
    this.realtime = undefined
    this.hub.dispose()
  }

  /**
   * @returns {Record<string, unknown>} the browser-visible session state.
   */
  state() {
    return {
      ok: true,
      ready: this.initialized,
      loggedIn: this.loggedIn,
      user: this.user ?? null,
      connection: this.connectionState,
      cursor: this.hub.seq,
      mfaRequired: this.lastError?.code === 'mfa_required',
      error: this.lastError === undefined ? null : { code: this.lastError.code, message: this.lastError.message },
      siteUrl: DEFAULT_SITE,
    }
  }

  /**
   * @param {{ nameOrEmail?: unknown, password?: unknown, mfaCode?: unknown, remember?: unknown }} body - login form.
   * @returns {Promise<Record<string, unknown>>}
   */
  async login(body) {
    const nameOrEmail = text(body.nameOrEmail, 200)
    const password = typeof body.password === 'string' ? body.password : ''
    const mfaCode = text(body.mfaCode, 16)
    const remember = body.remember !== false
    if (nameOrEmail === '' || password === '') {
      return { ok: false, code: 'invalid_input', message: '请输入账号和密码' }
    }

    const passwordMd5 = md5Hex(password)
    try {
      const grant = await this.api.login({ nameOrEmail, userPassword: passwordMd5, mfaCode })
      if (grant?.mfaRequired === true || grant?.mfa_required === true) {
        return { ok: false, code: 'mfa_required', message: '该账号启用了两步验证，请输入验证码', mfaRequired: true }
      }
      await this.#applyLogin(grant, { nameOrEmail, passwordMd5, remember })
      return { ok: true, user: this.user }
    } catch (error) {
      if (error instanceof FishPiError && error.code === 'mfa_required') {
        this.lastError = error
        this.#emitState()
        return { ok: false, code: error.code, message: '该账号启用了两步验证，请输入验证码', mfaRequired: true }
      }
      this.#rememberFailure(error)
      return {
        ok: false,
        code: error instanceof FishPiError ? error.code : 'internal',
        message: error instanceof Error ? error.message : '登录失败',
      }
    }
  }

  /** Forget the account and its stored credentials. */
  async logout() {
    this.loggedIn = false
    this.user = undefined
    this.record = undefined
    this.api.setToken('')
    this.tokenExpiresAt = 0
    this.lastError = undefined
    this.realtime?.stop()
    this.realtime = undefined
    this.connectionState = 'disconnected'
    try {
      await this.ctx.credentials.deleteRecord(CREDENTIAL_KEY)
    } catch (error) {
      warn(this.ctx, 'could not delete stored credentials', error)
    }
    this.#emitState()
    return { ok: true }
  }

  /**
   * @param {{ size?: unknown, before?: unknown, after?: unknown }} query - one window.
   * @returns {Promise<Record<string, unknown>>}
   */
  async messages(query) {
    const size = integer(query.size, 30, 1, 50)
    const before = typeof query.before === 'string' && /^\d+$/u.test(query.before) ? query.before : undefined
    const after = typeof query.after === 'string' && /^\d+$/u.test(query.after) ? query.after : undefined
    const data = await this.#withAuth(() => this.api.messages({ size, before, after }))
    const list = Array.isArray(data?.list) ? data.list.map(normalizeMessage).filter(Boolean) : []
    return {
      ok: true,
      list,
      hasMore: data?.hasMore === true,
      nextBefore: data?.nextBefore === undefined ? '' : String(data.nextBefore),
      nextAfter: data?.nextAfter === undefined ? '' : String(data.nextAfter),
    }
  }

  /**
   * Resolve medal icons for message authors, cached per user.
   * @param {string[]} names - public usernames.
   * @returns {Promise<Record<string, unknown>>} medal lists keyed by username.
   */
  async medals(names) {
    const clean = [...new Set(names
      .filter(name => typeof name === 'string' && name !== '' && /^[A-Za-z0-9_-]{1,64}$/u.test(name))
      .slice(0, 30))]
    const output = {}
    await Promise.all(clean.map(async name => {
      const cached = this.medalCache.get(name)
      if (cached !== undefined && Date.now() - cached.at < 10 * 60 * 1000) {
        output[name] = cached.medals
        return
      }
      try {
        const medals = normalizeMedals(await this.api.userMedals(name))
        this.medalCache.set(name, { at: Date.now(), medals })
        output[name] = medals
      } catch {
        output[name] = []
      }
    }))
    return { ok: true, medals: output }
  }

  /**
   * @param {{ name?: unknown }} query - public username.
   * @returns {Promise<Record<string, unknown>>} public profile and medal icons.
   */
  async userInfo(query) {
    const userName = typeof query.name === 'string' ? query.name.trim().slice(0, 64) : ''
    if (userName === '' || !/^[A-Za-z0-9_-]+$/u.test(userName)) {
      throw new FishPiError('用户名不正确', { code: 'invalid_input', status: 400 })
    }
    let source
    try {
      source = await this.#withAuth(() => this.api.legacyUser(userName))
    } catch {
      source = await this.#withAuth(() => this.api.userProfile(userName))
    }
    const raw = source !== null && typeof source === 'object' ? source : {}
    const profile = {
      id: raw.oId === undefined && raw.id === undefined ? '' : String(raw.oId ?? raw.id),
      userNo: raw.userNo === undefined || raw.userNo === null ? '' : String(raw.userNo),
      userName: typeof raw.userName === 'string' ? raw.userName : userName,
      userNickname: typeof raw.userNickname === 'string' ? raw.userNickname : '',
      userAvatarURL: typeof raw.userAvatarURL === 'string' ? raw.userAvatarURL : '',
      userIntro: typeof raw.userIntro === 'string' ? raw.userIntro : '',
      userURL: typeof raw.userURL === 'string' ? raw.userURL : '',
      userRole: typeof raw.userRole === 'string' ? raw.userRole : '',
      userCity: typeof raw.userCity === 'string' ? raw.userCity : '',
      cardBg: typeof raw.cardBg === 'string' ? raw.cardBg : '',
      userPoint: Number.isFinite(Number(raw.userPoint)) ? Number(raw.userPoint) : undefined,
      onlineMinute: Number.isFinite(Number(raw.onlineMinute)) ? Number(raw.onlineMinute) : undefined,
    }
    let medals = []
    try {
      medals = normalizeMedals(await this.api.userMedals(userName))
    } catch {
      medals = []
    }
    return { ok: true, profile, medals }
  }

  /**
   * @param {{ prefix?: unknown }} query - username prefix typed after `@`.
   * @returns {Promise<Record<string, unknown>>} matching users.
   */
  async suggestUsers(query) {
    const prefix = typeof query.prefix === 'string' ? query.prefix.slice(0, 64) : ''
    if (prefix === '' || !/^[A-Za-z0-9_-]+$/u.test(prefix)) return { ok: true, list: [] }
    const data = await this.#withAuth(() => this.api.suggestUsers(prefix))
    const list = Array.isArray(data?.list)
      ? data.list
          .filter(user => user !== null && typeof user === 'object')
          .map(user => ({
            id: user.id === undefined ? '' : String(user.id),
            userName: typeof user.userName === 'string' ? user.userName : '',
            userNickname: typeof user.userNickname === 'string' ? user.userNickname : '',
            userAvatarURL: typeof user.userAvatarURL === 'string' ? user.userAvatarURL : '',
          }))
      : []
    return { ok: true, list }
  }

  /**
   * Upload image files through a FishPi upload ticket and return their URLs.
   * @param {FormData} form - multipart body with one or more `file` entries.
   * @returns {Promise<Record<string, unknown>>} uploaded file names and URLs.
   */
  async upload(form) {
    const files = form.getAll('file').filter(value => value !== null && typeof value === 'object' && typeof value.arrayBuffer === 'function')
    if (files.length === 0) throw new FishPiError('请选择要上传的图片', { code: 'invalid_input', status: 400 })
    if (files.length > 9) throw new FishPiError('一次最多上传 9 张图片', { code: 'invalid_input', status: 400 })
    let total = 0
    for (const file of files) {
      const size = Number(file.size) || 0
      if (size === 0) throw new FishPiError('图片内容为空', { code: 'invalid_input', status: 400 })
      if (size > 10 * 1024 * 1024) throw new FishPiError('单张图片不能超过 10MB', { code: 'invalid_input', status: 413 })
      total += size
    }
    if (total > 30 * 1024 * 1024) throw new FishPiError('图片总大小不能超过 30MB', { code: 'invalid_input', status: 413 })

    const ticket = await this.#withAuth(() => this.api.uploadTicket())
    if (ticket === null || typeof ticket !== 'object' || typeof ticket.uploadURL !== 'string') {
      throw new FishPiError('上传票据无效', { code: 'invalid_response' })
    }
    const fieldName = typeof ticket.fieldName === 'string' && ticket.fieldName !== '' ? ticket.fieldName : 'file'
    const upload = new FormData()
    const names = new Map()
    files.forEach((file, index) => {
      const original = typeof file.name === 'string' && file.name !== '' ? file.name : `image-${index + 1}.png`
      let name = original
      if (names.has(name)) {
        const dot = original.lastIndexOf('.')
        const stem = dot > 0 ? original.slice(0, dot) : original
        const ext = dot > 0 ? original.slice(dot) : ''
        name = `${stem}-${index + 1}${ext}`
      }
      names.set(name, original)
      upload.append(fieldName, file, name)
    })

    let response
    try {
      response = await fetch(ticket.uploadURL, {
        method: 'POST',
        headers: { authorization: `Bearer ${ticket.ticket}` },
        body: upload,
        signal: AbortSignal.timeout(60_000),
      })
    } catch (error) {
      throw new FishPiError('图片上传失败，请检查网络后重试', { code: 'network', cause: error })
    }
    let payload = null
    try {
      payload = await response.json()
    } catch {
      // The status and upload response carry the failure.
    }
    if (!response.ok || payload?.code !== 0 && payload?.code !== '0') {
      throw new FishPiError(
        typeof payload?.msg === 'string' && payload.msg !== '' ? payload.msg : `图片上传失败（HTTP ${response.status}）`,
        { code: 'upload_failed', status: response.status },
      )
    }
    const succMap = payload?.data?.succMap !== null && typeof payload?.data?.succMap === 'object' ? payload.data.succMap : {}
    const uploaded = []
    for (const [name, original] of names) {
      const url = succMap[name]
      if (typeof url === 'string' && url !== '') uploaded.push({ name: original, url })
    }
    if (uploaded.length === 0) {
      throw new FishPiError('图片上传失败，请稍后重试', { code: 'upload_failed', status: 502 })
    }
    return { ok: true, files: uploaded }
  }

  /**
   * @param {{ id?: unknown }} query - red-packet message id.
   * @returns {Promise<Record<string, unknown>>} the red-packet detail.
   */
  async redPacket(query) {
    const id = typeof query.id === 'string' && /^\d+$/u.test(query.id) ? query.id : ''
    if (id === '') throw new FishPiError('红包 ID 不正确', { code: 'invalid_input', status: 400 })
    const detail = await this.#withAuth(() => this.api.redPacket(id))
    return { ok: true, detail }
  }

  /**
   * @param {{ id?: unknown, gesture?: unknown, riskAccepted?: unknown, requestId?: unknown }} body - claim form.
   * @returns {Promise<Record<string, unknown>>} the claim and refreshed detail.
   */
  async claimRedPacket(body) {
    const id = typeof body.id === 'string' && /^\d+$/u.test(body.id) ? body.id : ''
    if (id === '') throw new FishPiError('红包 ID 不正确', { code: 'invalid_input', status: 400 })
    const gesture = Number.isInteger(body.gesture) && body.gesture >= 0 && body.gesture <= 2 ? body.gesture : undefined
    const riskAccepted = body.riskAccepted === true
    const rawId = typeof body.requestId === 'string' ? body.requestId.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 64) : ''
    const requestId = rawId === '' ? crypto.randomUUID() : rawId
    const idempotencyKey = `fishpi-chat-claim-${requestId}`
    const claim = await this.#withAuth(async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await this.api.claimRedPacket(id, { gesture, riskAccepted }, idempotencyKey)
        } catch (error) {
          const retryable = error instanceof FishPiError
            && attempt === 0
            && (error.code === 'confirmation_required' || error.code === 'network')
          if (!retryable) throw error
          if (error.code === 'network') await delay(400)
        }
      }
    })
    let detail
    try {
      detail = await this.#withAuth(() => this.api.redPacket(id))
    } catch {
      detail = undefined
    }
    return { ok: true, claim, detail: detail ?? null }
  }

  /** @returns {Promise<Record<string, unknown>>} the current topic. */
  async topic() {
    const data = await this.#withAuth(() => this.api.topic())
    return { ok: true, text: typeof data?.text === 'string' ? data.text : '' }
  }

  /** @returns {Promise<Record<string, unknown>>} visible online users. */
  async online() {
    const data = await this.#withAuth(() => this.api.onlineUsers({ size: 50 }))
    const list = Array.isArray(data?.list)
      ? data.list
          .filter(user => user !== null && typeof user === 'object')
          .map(user => ({
            id: user.id === undefined ? '' : String(user.id),
            userName: typeof user.userName === 'string' ? user.userName : '',
            userAvatarURL: typeof user.userAvatarURL === 'string' ? user.userAvatarURL : '',
          }))
      : []
    return { ok: true, total: Number(data?.pagination?.total) || list.length, list }
  }

  /**
   * Send one message with a caller-stable request id.
   * @param {{ content?: unknown, requestId?: unknown }} body - composer payload.
   * @returns {Promise<Record<string, unknown>>}
   */
  async send(body) {
    const content = text(body.content, MAX_MESSAGE_LENGTH + 1)
    if (content === '') throw new FishPiError('消息不能为空', { code: 'invalid_input', status: 400 })
    if (content.length > MAX_MESSAGE_LENGTH) throw new FishPiError('消息超过 4096 个字符', { code: 'invalid_input', status: 400 })
    const rawId = typeof body.requestId === 'string' ? body.requestId.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 64) : ''
    const requestId = rawId === '' ? crypto.randomUUID() : rawId
    const idempotencyKey = `fishpi-chat-${requestId}`

    const accepted = await this.#withAuth(async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await this.api.send(content, idempotencyKey)
        } catch (error) {
          const retryable = error instanceof FishPiError
            && attempt === 0
            && (error.code === 'confirmation_required' || error.code === 'network')
          if (!retryable) throw error
          if (error.code === 'network') await delay(400)
        }
      }
    })

    let message
    try {
      const raw = await this.#withAuth(() => this.api.message(String(accepted?.id ?? '')))
      message = normalizeMessage(raw)
    } catch {
      message = undefined
    }
    if (message !== undefined) this.hub.emit('message.created', { message })
    return {
      ok: true,
      id: accepted?.id === undefined ? '' : String(accepted.id),
      createdAt: Number(accepted?.createdAt) || Date.now(),
      message: message ?? null,
    }
  }

  /**
   * @param {{ since?: unknown }} query - browser cursor.
   * @param {AbortSignal} signal - request lifetime.
   * @returns {Promise<Record<string, unknown>>}
   */
  async events(query, signal) {
    const since = integer(query.since, 0, 0, Number.MAX_SAFE_INTEGER)
    return this.hub.wait(since, signal, EVENT_WAIT_MS)
  }

  /**
   * @param {{ accessToken?: string, expiresIn?: number }} grant - a successful login response.
   * @param {{ nameOrEmail: string, passwordMd5: string, remember: boolean }} account - the credentials to keep.
   */
  async #applyLogin(grant, account) {
    const token = typeof grant?.accessToken === 'string' ? grant.accessToken : ''
    if (token === '') throw new FishPiError('登录响应缺少访问令牌', { code: 'invalid_response' })
    this.api.setToken(token)
    this.tokenExpiresAt = Number(grant?.expiresIn) > 0 ? Date.now() + Number(grant.expiresIn) * 1000 : 0
    const me = await this.api.me()
    const user = normalizeMe(me)
    if (user === undefined) throw new FishPiError('无法读取账号资料', { code: 'invalid_response' })
    this.user = user
    this.loggedIn = true
    this.lastError = undefined
    this.record = {
      version: 1,
      nameOrEmail: account.nameOrEmail,
      passwordMd5: account.remember ? account.passwordMd5 : undefined,
      remember: account.remember,
      accessToken: token,
      tokenExpiresAt: this.tokenExpiresAt,
      user,
    }
    await this.#persist()
    this.#startRealtime()
    this.#emitState()
  }

  /**
   * @param {string} nameOrEmail - stored account name.
   * @param {string} passwordMd5 - stored digest.
   * @param {boolean} remember - whether to keep the digest.
   */
  async #loginWithDigest(nameOrEmail, passwordMd5, remember) {
    if (this.loginTask !== undefined) {
      await this.loginTask
      return
    }
    this.loginTask = (async () => {
      const grant = await this.api.login({ nameOrEmail, userPassword: passwordMd5 })
      await this.#applyLogin(grant, { nameOrEmail, passwordMd5, remember })
    })()
    try {
      await this.loginTask
    } finally {
      this.loginTask = undefined
    }
  }

  /**
   * @param {boolean} force - renew even when the current token looks fresh.
   */
  async #ensureAuth(force) {
    if (this.loggedIn && !force && (this.tokenExpiresAt === 0 || this.tokenExpiresAt > Date.now() + 60_000)) return
    if (this.record?.passwordMd5) {
      try {
        await this.#loginWithDigest(String(this.record.nameOrEmail ?? ''), String(this.record.passwordMd5), this.record.remember !== false)
        return
      } catch (error) {
        this.#rememberFailure(error)
        throw error
      }
    }
    this.loggedIn = false
    this.api.setToken('')
    const error = new FishPiError('登录已失效，请在设置中重新登录', { code: 'unauthorized', status: 401 })
    this.lastError = error
    this.#emitState()
    throw error
  }

  /**
   * Run an authenticated operation, renewing once after a 401.
   * @template T
   * @param {() => Promise<T>} operation - the API call.
   * @returns {Promise<T>}
   */
  async #withAuth(operation) {
    await this.#ensureAuth(false)
    try {
      const result = await operation()
      this.lastError = undefined
      return result
    } catch (error) {
      if (error instanceof FishPiError && (error.status === 401 || error.code === 'unauthorized')) {
        this.loggedIn = false
        this.api.setToken('')
        await this.#ensureAuth(true)
        const result = await operation()
        this.lastError = undefined
        return result
      }
      throw error
    }
  }

  /** Persist the current account record without failing the caller. */
  async #persist() {
    if (this.record === undefined) return
    try {
      await this.ctx.credentials.modifyRecord(CREDENTIAL_KEY, () => ({ kind: 'grant', payload: this.record }))
    } catch (error) {
      warn(this.ctx, 'could not store credentials', error)
    }
  }

  /** Start a fresh socket for the current token. */
  #startRealtime() {
    if (this.stopped) return
    this.realtime?.stop()
    this.connectionState = 'connecting'
    this.realtime = new ChatRealtime({
      siteUrl: DEFAULT_SITE,
      getTicket: async () => {
        try {
          await this.#ensureAuth(false)
          return await this.api.realtimeTicket()
        } catch (error) {
          if (error instanceof FishPiError && (error.status === 401 || error.code === 'unauthorized')) {
            await this.#ensureAuth(true)
            return await this.api.realtimeTicket()
          }
          throw error
        }
      },
      onState: state => {
        this.connectionState = state
        this.hub.emit('connection', { state })
        this.#emitState()
      },
      onEvent: event => { void this.#onRealtime(event) },
      onError: error => {
        if (error instanceof FishPiError && (error.status === 401 || error.code === 'unauthorized')) {
          this.loggedIn = false
          this.api.setToken('')
          this.#emitState()
        }
      },
    })
    this.realtime.start()
  }

  /**
   * @param {{ type: string, data: any }} event - one socket event.
   */
  async #onRealtime(event) {
    if (this.stopped) return
    if (event.type === 'ready') {
      this.hub.emit('sync', { reason: 'ready' })
      return
    }
    const message = event.data
    if (message === null || typeof message !== 'object') return
    switch (message.type) {
      case 'chat.message.created':
      case 'chat.message.updated': {
        const snapshot = normalizeMessage(message.data?.message)
        if (snapshot !== undefined) {
          this.hub.emit(message.type === 'chat.message.created' ? 'message.created' : 'message.updated', { message: snapshot })
          return
        }
        const id = message.data?.messageId === undefined ? '' : String(message.data.messageId)
        if (id !== '') await this.#fetchAndEmitMessage(id, message.type === 'chat.message.updated')
        return
      }
      case 'chat.message.deleted': {
        const id = message.data?.messageId === undefined ? '' : String(message.data.messageId)
        if (id !== '') this.hub.emit('message.deleted', { messageId: id })
        return
      }
      case 'chat.message.reactions':
        return
      case 'chat.topic_changed': {
        void this.#refreshTopic()
        return
      }
      case 'chat.sync_required': {
        this.hub.emit('sync', { reason: 'server' })
        return
      }
      case 'chat.presence.changed': {
        const data = message.data ?? {}
        this.hub.emit('presence', {
          id: data.id === undefined ? '' : String(data.id),
          kind: data.kind === 'leave' ? 'leave' : 'join',
          text: typeof data.text === 'string' ? data.text : '',
          actor: data.actor ?? null,
          mount: data.mount ?? null,
          avatarURL: typeof data.avatarURL === 'string' ? data.avatarURL : '',
          createdAt: Number(data.createdAt) || Date.now(),
        })
        return
      }
      case 'chat.red_packet.claimed': {
        const data = message.data ?? {}
        this.hub.emit('redPacket.claimed', {
          id: data.id === undefined ? '' : String(data.id),
          sender: data.sender ?? null,
          actor: data.actor ?? null,
          got: Number(data.got) || 0,
          count: Number(data.count) || 0,
          createdAt: Number(data.createdAt) || Date.now(),
        })
        return
      }
      default:
        return
    }
  }

  /** Re-read the topic and publish it. */
  async #refreshTopic() {
    try {
      const data = await this.#withAuth(() => this.api.topic())
      this.hub.emit('topic', { text: typeof data?.text === 'string' ? data.text : '' })
    } catch {
      // A topic refresh is best-effort; the next sync retries it.
    }
  }

  /**
   * @param {string} id - message id from a revision-only event.
   * @param {boolean} updated - whether the message already existed.
   */
  async #fetchAndEmitMessage(id, updated) {
    try {
      const raw = await this.#withAuth(() => this.api.message(id))
      const message = normalizeMessage(raw)
      if (message !== undefined) {
        this.hub.emit(updated ? 'message.updated' : 'message.created', { message })
      }
    } catch {
      // The next sync reads the window again, so a missed snapshot is recoverable.
    }
  }

  /** Publish the whole session state to every browser. */
  #emitState() {
    this.hub.emit('state', this.state())
  }

  /**
   * @param {unknown} error - the last failed operation.
   */
  #rememberFailure(error) {
    this.lastError = error instanceof FishPiError
      ? error
      : new FishPiError(error instanceof Error ? error.message : '操作失败', { code: 'internal' })
    if (this.lastError.code === 'unauthorized' || this.lastError.status === 401) {
      this.loggedIn = false
      this.api.setToken('')
    }
    this.#emitState()
  }
}

/**
 * Host plugin body.
 * @param {import('@deepseek-ai/cordis').Context} ctx - loader context with `connection` and `credentials`.
 */
export function apply(ctx) {
  const hub = new EventHub({ limit: EVENT_LOG_LIMIT })
  const chat = new FishPiChat({ ctx, hub })

  /**
   * @param {string} path - exact path below `/api`.
   * @param {('GET'|'POST')[]} methods - methods this route owns.
   * @param {(request: Request) => Promise<Response>} fetch - authenticated handler.
   */
  const route = (path, methods, fetch) => {
    ctx.effect(
      () => ctx.connection.fetch.register({ path: `${API_PREFIX}${path}`, methods, requestBody: 'buffered', fetch }),
      `fishpi-chat route ${path}`,
    )
  }

  route('/state', ['GET'], async () => json(chat.state()))
  route('/login', ['POST'], async request => {
    try {
      return json(await chat.login(await readJson(request)))
    } catch (error) {
      return failure(error)
    }
  })
  route('/logout', ['POST'], async () => {
    try {
      return json(await chat.logout())
    } catch (error) {
      return failure(error)
    }
  })
  route('/messages', ['GET'], async request => {
    try {
      const url = new URL(request.url)
      return json(await chat.messages({
        size: url.searchParams.get('size'),
        before: url.searchParams.get('before'),
        after: url.searchParams.get('after'),
      }))
    } catch (error) {
      return failure(error)
    }
  })
  route('/send', ['POST'], async request => {
    try {
      return json(await chat.send(await readJson(request)))
    } catch (error) {
      return failure(error)
    }
  })
  route('/medals', ['GET'], async request => {
    try {
      const url = new URL(request.url)
      const names = (url.searchParams.get('names') ?? '').split(',').filter(Boolean)
      return json(await chat.medals(names))
    } catch (error) {
      return failure(error)
    }
  })
  route('/user', ['GET'], async request => {
    try {
      const url = new URL(request.url)
      return json(await chat.userInfo({ name: url.searchParams.get('name') }))
    } catch (error) {
      return failure(error)
    }
  })
  route('/users', ['GET'], async request => {
    try {
      const url = new URL(request.url)
      return json(await chat.suggestUsers({ prefix: url.searchParams.get('prefix') }))
    } catch (error) {
      return failure(error)
    }
  })
  route('/upload', ['POST'], async request => {
    try {
      return json(await chat.upload(await request.formData()))
    } catch (error) {
      return failure(error)
    }
  })
  route('/red-packet', ['GET'], async request => {
    try {
      const url = new URL(request.url)
      return json(await chat.redPacket({ id: url.searchParams.get('id') }))
    } catch (error) {
      return failure(error)
    }
  })
  route('/red-packet/claim', ['POST'], async request => {
    try {
      return json(await chat.claimRedPacket(await readJson(request)))
    } catch (error) {
      return failure(error)
    }
  })
  route('/topic', ['GET'], async () => {
    try {
      return json(await chat.topic())
    } catch (error) {
      return failure(error)
    }
  })
  route('/online', ['GET'], async () => {
    try {
      return json(await chat.online())
    } catch (error) {
      return failure(error)
    }
  })
  route('/events', ['GET'], async request => {
    try {
      const url = new URL(request.url)
      return json(await chat.events({ since: url.searchParams.get('since') }, request.signal))
    } catch (error) {
      return failure(error)
    }
  })

  ctx.effect(() => () => { chat.dispose() }, 'fishpi-chat lifetime')
  void chat.initialize()
}

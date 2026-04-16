const WebSocket = require('ws');
const { EventEmitter } = require('events');
const { loadOrCreateDeviceIdentity, signDevicePayload, buildDeviceAuthPayload, publicKeyRawBase64UrlFromPem } = require('./device-identity');

// Valid client IDs from Gateway protocol
const GATEWAY_CLIENT_IDS = {
  WEBCHAT_UI: 'webchat-ui',
  CONTROL_UI: 'openclaw-control-ui',
  WEBCHAT: 'webchat',
  CLI: 'cli',
  GATEWAY_CLIENT: 'gateway-client',
  MACOS_APP: 'openclaw-macos',
  IOS_APP: 'openclaw-ios',
  ANDROID_APP: 'openclaw-android',
  NODE_HOST: 'node-host',
  TEST: 'test',
  FINGERPRINT: 'fingerprint',
  PROBE: 'openclaw-probe',
};

// Valid client modes from Gateway protocol
const GATEWAY_CLIENT_MODES = {
  WEBCHAT: 'webchat',
  CLI: 'cli',
  UI: 'ui',
  BACKEND: 'backend',
  NODE: 'node',
  PROBE: 'probe',
  TEST: 'test',
};

class GatewayClient extends EventEmitter {
  constructor(config, logManager) {
    super();
    this.config = config;
    this.logManager = logManager;
    this.ws = null;
    this.pending = new Map();
    this.closed = false;
    this.lastSeq = null;
    this.connectNonce = null;
    this.connectSent = false;
    this.handshakeComplete = false;
    this.deviceIdentity = loadOrCreateDeviceIdentity();
    this.requestId = 0;
  }

  async connect() {
    this.closed = false;
    await this.connectInternal();
  }

  async connectInternal() {
    if (this.closed) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.log('info', `Connecting to gateway at ${this.config.url}`);

        this.ws = new WebSocket(this.config.url);

        this.ws.on('open', async () => {
          this.log('info', 'WebSocket connection established');
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString('utf8'));
        });

        this.ws.on('close', (code, reason) => {
          const reasonStr = reason.toString('utf8');
          this.log('info', `WebSocket closed: ${code} - ${reasonStr}`);
          this.ws = null;
          this.handshakeComplete = false;
          this.connectSent = false;
          this.connectNonce = null;
          this.flushPending(new Error(`Gateway closed (${code}): ${reasonStr}`));
          this.emit('disconnected', { code, reason: reasonStr });
        });

        this.ws.on('error', (err) => {
          this.log('error', `WebSocket error: ${err.message}`);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    this.closed = true;
    if (this.ws) {
      this.log('info', 'Disconnecting from gateway');

      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.log('info', 'Client-initiated disconnect');
        } catch (err) {
          // Ignore errors during disconnect
        }
      }

      this.ws.close();
      this.ws = null;
    }
    this.flushPending(new Error('Gateway client stopped'));
    this.connectNonce = null;
    this.connectSent = false;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN && this.handshakeComplete;
  }

  async sendConnect() {
    if (this.connectSent) {
      return;
    }
    this.connectSent = true;

    this.log('info', 'Sending connect message');

    const auth = this.config.token || this.config.password
      ? {
          token: this.config.token,
          password: this.config.password,
        }
      : undefined;

    const signedAtMs = Date.now();
    const nonce = this.connectNonce || '';

    const authPayload = buildDeviceAuthPayload({
      deviceId: this.deviceIdentity.deviceId,
      clientId: GATEWAY_CLIENT_IDS.MACOS_APP,
      clientMode: GATEWAY_CLIENT_MODES.UI,
      role: 'operator',
      scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
      signedAtMs,
      token: this.config.token ?? null,
      nonce,
      platform: process.platform,
      deviceFamily: 'desktop',
    });

    const signature = signDevicePayload(this.deviceIdentity.privateKeyPem, authPayload);

    this.log('info', `Device auth payload: ${authPayload}`);
    this.log('info', `Device ID: ${this.deviceIdentity.deviceId}`);
    this.log('info', `Public key (raw): ${publicKeyRawBase64UrlFromPem(this.deviceIdentity.publicKeyPem)}`);
    this.log('info', `Signature: ${signature.substring(0, 20)}...`);

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: GATEWAY_CLIENT_IDS.MACOS_APP,
        version: '1.0.0',
        platform: process.platform,
        mode: GATEWAY_CLIENT_MODES.UI,
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
      device: {
        id: this.deviceIdentity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(this.deviceIdentity.publicKeyPem),
        signature: signature,
        signedAt: signedAtMs,
        nonce: this.connectNonce || '',
      },
      caps: ['tool-events'],
      auth,
      userAgent: `openclaw-electron/1.0.0 (${process.platform})`,
      locale: 'en-US',
    };

    try {
      const hello = await this.request('connect', params);
      this.log('info', `Connected successfully. Protocol version: ${hello.protocol}`);

      this.handshakeComplete = true;

      if (hello.auth?.deviceToken) {
        this.log('info', 'Device token issued');
      }

      this.emit('connected', hello);
    } catch (error) {
      this.log('error', `Connect failed: ${error.message}`);
      if (error.stack) {
        this.log('error', `Error stack: ${error.stack}`);
      }
      this.ws?.close(4008, 'connect failed');
      throw error;
    }
  }

  handleMessage(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.log('warn', `Failed to parse message: ${raw.substring(0, 100)}`);
      return;
    }

    const frame = parsed;

    if (frame.type === 'event') {
      const evt = parsed;

      if (evt.event === 'connect.challenge') {
        const payload = evt.payload;
        const nonce = payload && typeof payload.nonce === 'string' ? payload.nonce : null;
        if (nonce) {
          this.log('info', 'Received connect.challenge');
          this.connectNonce = nonce;
          this.sendConnect();
        }
        return;
      }

      const seq = typeof evt.seq === 'number' ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq !== this.lastSeq + 1) {
          this.emit('gap', { expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }

      this.log('debug', `Received event: ${evt.event}`);
      this.emit('event', evt);
      return;
    }

    if (frame.type === 'res') {
      const res = parsed;
      const pending = this.pending.get(res.id);

      if (pending) {
        this.pending.delete(res.id);
        if (res.ok) {
          pending.resolve(res.payload);
        } else {
          const errorDetails = res.error?.details ? ` (${JSON.stringify(res.error.details)})` : '';
          pending.reject(new Error(`${res.error?.message || 'Request failed'}${errorDetails}`));
        }
      }
      return;
    }
  }

  async request(method, params) {
    const isConnectRequest = method === 'connect';
    if ((!this.connected && !isConnectRequest) || !this.ws) {
      throw new Error('Not connected to gateway');
    }

    const id = `req-${++this.requestId}`;
    const frame = {
      type: 'req',
      id,
      method,
      params: params || {},
    };

    this.log('debug', `Sending request: ${method}`);

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      try {
        this.ws.send(JSON.stringify(frame));
      } catch (err) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Send a notification (fire-and-forget, no response expected)
   * Used for abort and other operations where we don't need to wait for response
   */
  sendNotification(method, params) {
    if (!this.connected || !this.ws) {
      this.log('warn', `Cannot send notification ${method}: not connected`);
      return;
    }

    const id = `req-${++this.requestId}`;
    const frame = {
      type: 'req',
      id,
      method,
      params: params || {},
    };

    this.log('info', `[NOTIFICATION] Sending ${method} with params: ${JSON.stringify(params)}`);

    try {
      const frameStr = JSON.stringify(frame);
      this.ws.send(frameStr);
      this.log('info', `[NOTIFICATION] Sent ${method} successfully, frame: ${frameStr.substring(0, 200)}`);
    } catch (err) {
      this.log('error', `[NOTIFICATION] Failed to send ${method}: ${err}`);
    }
  }

  async sendMessage(sessionKey, message, attachments) {
    const idempotencyKey = `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    const params = {
      sessionKey,
      message,
      idempotencyKey,
    };

    if (attachments && attachments.length > 0) {
      params.attachments = attachments;
    }

    const result = await this.request('chat.send', params);
    return result.runId;
  }

  abortChat(sessionKey, runId) {
    console.log('🛑 GatewayClient.abortChat called');
    console.log('   - sessionKey:', sessionKey);
    console.log('   - runId:', runId);

    const params = { sessionKey };
    if (runId) {
      params.runId = runId;
    }

    // Use sendNotification for fire-and-forget (no response expected)
    console.log('   ✅ Sending chat.abort notification to gateway (fire-and-forget)...');
    this.sendNotification('chat.abort', params);
    console.log('   ✅ chat.abort notification sent');
  }

  async getChatHistory(sessionKey, limit = 200) {
    return this.request('chat.history', { sessionKey, limit });
  }

  async listSessions(params) {
    return this.request('sessions.list', params || {});
  }

  async resolveSession(params) {
    return this.request('sessions.resolve', params || {});
  }

  async patchSession(key, patch) {
    await this.request('sessions.patch', { key, ...patch });
  }

  async deleteSession(key, deleteTranscript = true) {
    await this.request('sessions.delete', { key, deleteTranscript });
  }

  async listAgents() {
    return this.request('agents.list', {});
  }

  async listCronJobs(params) {
    return this.request('cron.list', params || {});
  }

  async addCronJob(job) {
    return this.request('cron.add', job);
  }

  async updateCronJob(id, patch) {
    return this.request('cron.update', { id, patch });
  }

  async removeCronJob(id) {
    return this.request('cron.remove', { id });
  }

  async runCronJob(id, mode) {
    return this.request('cron.run', { id, mode: mode || 'force' });
  }

  async getSystemPresence() {
    return this.request('system-presence', {});
  }

  async getHealth() {
    return this.request('health', {});
  }

  flushPending(err) {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    this.logManager.log('gateway', logMessage);
  }
}

module.exports = { GatewayClient };

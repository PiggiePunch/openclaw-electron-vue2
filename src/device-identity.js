const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

const STORAGE_FILE = 'device-identity.json';

function getStoragePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, STORAGE_FILE);
}

function base64UrlEncode(buf) {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(input) {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function derivePublicKeyRaw(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: 'spki', format: 'der' });
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPem) {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const deviceId = fingerprintPublicKey(publicKeyPem);

  console.log('=== Device Identity Generated ===');
  console.log('deviceId:', deviceId);
  console.log('publicKeyPem:', publicKeyPem);
  console.log('privateKeyPem:', privateKeyPem);
  console.log('================================');

  return {
    deviceId,
    publicKeyPem,
    privateKeyPem,
  };
}

function loadOrCreateDeviceIdentity() {
  const storagePath = getStoragePath();
  console.log('Device Identity Storage Path:', storagePath);

  try {
    if (fs.existsSync(storagePath)) {
      const raw = fs.readFileSync(storagePath, 'utf8');
      const parsed = JSON.parse(raw);

      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.publicKeyPem === 'string' &&
        typeof parsed.privateKeyPem === 'string'
      ) {
        const derivedId = fingerprintPublicKey(parsed.publicKeyPem);
        if (derivedId && derivedId !== parsed.deviceId) {
          const updated = {
            ...parsed,
            deviceId: derivedId,
          };
          fs.writeFileSync(storagePath, JSON.stringify(updated, null, 2));
          console.log('=== Device Identity Loaded (Updated) ===');
          console.log('deviceId:', derivedId);
          console.log('publicKeyPem:', parsed.publicKeyPem);
          console.log('privateKeyPem:', parsed.privateKeyPem);
          console.log('========================================');
          return {
            deviceId: derivedId,
            publicKeyPem: parsed.publicKeyPem,
            privateKeyPem: parsed.privateKeyPem,
          };
        }

        console.log('=== Device Identity Loaded ===');
        console.log('deviceId:', parsed.deviceId);
        console.log('publicKeyPem:', parsed.publicKeyPem);
        console.log('privateKeyPem:', parsed.privateKeyPem);
        console.log('===============================');
        return {
          deviceId: parsed.deviceId,
          publicKeyPem: parsed.publicKeyPem,
          privateKeyPem: parsed.privateKeyPem,
        };
      }
    }
  } catch (error) {
    console.error('Failed to load device identity, generating new one:', error);
  }

  const identity = generateIdentity();
  const stored = {
    version: 1,
    deviceId: identity.deviceId,
    publicKeyPem: identity.publicKeyPem,
    privateKeyPem: identity.privateKeyPem,
    createdAtMs: Date.now(),
  };

  try {
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storagePath, JSON.stringify(stored, null, 2));
  } catch (error) {
    console.error('Failed to save device identity:', error);
  }

  return identity;
}

function signDevicePayload(privateKeyPem, payload) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), key);
  return base64UrlEncode(sig);
}

function publicKeyRawBase64UrlFromPem(publicKeyPem) {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

function buildDeviceAuthPayload(params) {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';

  return [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
  ].join('|');
}

function buildDeviceAuthPayloadV3(params) {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  const platform = normalizeDeviceMetadataForAuth(params.platform);
  const deviceFamily = normalizeDeviceMetadataForAuth(params.deviceFamily);

  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join('|');
}

function normalizeDeviceMetadataForAuth(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/[A-Z]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 32)
  );
}

module.exports = {
  loadOrCreateDeviceIdentity,
  signDevicePayload,
  publicKeyRawBase64UrlFromPem,
  buildDeviceAuthPayload,
  buildDeviceAuthPayloadV3,
};

const ENC_PREFIX = 'enc:v1:';
const PBKDF2_SALT = 'layer-zero-ai-key-salt-v1';
const PBKDF2_ITERATIONS = 120000;
const APP_PEPPER = 'layer-zero-ai-key-pepper-v1';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function getEncryptionKey() {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
        throw new Error('Web Crypto is not available');
    }

    const secretMaterial = `${window.location.origin}|${navigator.userAgent}|${APP_PEPPER}`;
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(secretMaterial),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode(PBKDF2_SALT),
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptText(plainText) {
    if (!plainText) return '';

    const key = await getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plainText)
    );

    const encryptedBytes = new Uint8Array(encrypted);
    const payload = new Uint8Array(iv.length + encryptedBytes.length);
    payload.set(iv, 0);
    payload.set(encryptedBytes, iv.length);

    return `${ENC_PREFIX}${toBase64(payload)}`;
}

export async function decryptText(storedValue) {
    if (!storedValue) return '';
    if (!storedValue.startsWith(ENC_PREFIX)) {
        // 레거시 평문 데이터 호환
        return storedValue;
    }

    const payloadBytes = fromBase64(storedValue.slice(ENC_PREFIX.length));
    const iv = payloadBytes.slice(0, 12);
    const encrypted = payloadBytes.slice(12);

    const key = await getEncryptionKey();
    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
    );
    return decoder.decode(decrypted);
}

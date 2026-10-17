const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_SECRET = 'sgb_telephony_secret_key_32bytes_long!'; // Fallback key if process.env.TELEPHONY_SECRET_KEY not set

function getSecretKey() {
    let key = process.env.TELEPHONY_SECRET_KEY || DEFAULT_SECRET;
    return crypto.createHash('sha256').update(key).digest(); // Always 32 bytes
}

function encryptToken(plaintext) {
    if (!plaintext) return { encrypted_value: '', credential_last_four: '' };
    const iv = crypto.randomBytes(16);
    const key = getSecretKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    const tokenLastFour = plaintext.length >= 4 ? plaintext.slice(-4) : plaintext;
    const combinedPayload = `${iv.toString('hex')}:${authTag}:${encrypted}`;

    return {
        encrypted_value: combinedPayload,
        credential_last_four: tokenLastFour
    };
}

function decryptToken(combinedPayload) {
    if (!combinedPayload) return '';
    try {
        const parts = combinedPayload.split(':');
        if (parts.length !== 3) return '';
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        const key = getSecretKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error("❌ Token Decryption Failed:", err.message);
        return '';
    }
}

function getMaskedToken(lastFour) {
    return `ace_live_****${lastFour || '0000'}`;
}

module.exports = {
    encryptToken,
    decryptToken,
    getMaskedToken
};

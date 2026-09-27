// ============================================================
// validation.utils.js — Backend Validation & Sanitization Helpers
// ============================================================

const sanitizeNumberOnly = (val, maxLen) => {
    if (val === null || val === undefined) return '';
    let cleaned = String(val).replace(/\D/g, '');
    if (maxLen && cleaned.length > maxLen) {
        cleaned = cleaned.substring(0, maxLen);
    }
    return cleaned;
};

const sanitizePhone = (val) => {
    return sanitizeNumberOnly(val, 10);
};

const sanitizePincode = (val) => {
    return sanitizeNumberOnly(val, 6);
};

const sanitizePositiveNumber = (val, allowDecimal = false, maxLen = 10) => {
    if (val === null || val === undefined) return 0;
    let str = String(val);
    if (allowDecimal) {
        str = str.replace(/[^0-9\.]/g, '');
        const parts = str.split('.');
        if (parts.length > 2) {
            str = parts[0] + '.' + parts.slice(1).join('');
        }
    } else {
        str = str.replace(/\D/g, '');
    }
    if (maxLen && str.length > maxLen) {
        str = str.substring(0, maxLen);
    }
    return str ? (allowDecimal ? parseFloat(str) : parseInt(str, 10)) : 0;
};

const sanitizeAlphabetOnly = (val, maxLen) => {
    if (val === null || val === undefined) return '';
    let cleaned = String(val).replace(/[^a-zA-Z\s]/g, '').replace(/\s{2,}/g, ' ');
    if (maxLen && cleaned.length > maxLen) {
        cleaned = cleaned.substring(0, maxLen);
    }
    return cleaned;
};

const sanitizeAlphanumeric = (val, maxLen) => {
    if (val === null || val === undefined) return '';
    let cleaned = String(val).replace(/[^a-zA-Z0-9\s\&\-\/\.\#\,]/g, '');
    if (maxLen && cleaned.length > maxLen) {
        cleaned = cleaned.substring(0, maxLen);
    }
    return cleaned;
};

const sanitizeGSTIN = (val) => {
    if (val === null || val === undefined) return '';
    let cleaned = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length > 15) {
        cleaned = cleaned.substring(0, 15);
    }
    return cleaned;
};

const isValidEmail = (email) => {
    if (!email || !String(email).trim()) return true;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).trim());
};

const isValidPhone = (phone) => {
    if (!phone) return true;
    return /^\d{10}$/.test(String(phone).trim());
};

const isValidPincode = (pincode) => {
    if (!pincode) return true;
    return /^\d{6}$/.test(String(pincode).trim());
};

module.exports = {
    sanitizeNumberOnly,
    sanitizePhone,
    sanitizePincode,
    sanitizePositiveNumber,
    sanitizeAlphabetOnly,
    sanitizeAlphanumeric,
    sanitizeGSTIN,
    isValidEmail,
    isValidPhone,
    isValidPincode
};

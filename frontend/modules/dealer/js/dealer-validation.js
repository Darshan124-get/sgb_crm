// ============================================================
// dealer-validation.js — Universal Dealer Panel Input Validation
// ============================================================

const DealerValidation = {
    // 1. Number Only (Digits 0-9)
    sanitizeNumberOnly: function(val, maxLen) {
        if (val === null || val === undefined) return '';
        let cleaned = String(val).replace(/\D/g, '');
        if (maxLen && cleaned.length > maxLen) {
            cleaned = cleaned.substring(0, maxLen);
        }
        return cleaned;
    },

    // 2. Phone Number (Digits 0-9, max 10)
    sanitizePhone: function(val) {
        return DealerValidation.sanitizeNumberOnly(val, 10);
    },

    // 3. Pincode (Digits 0-9, max 6)
    sanitizePincode: function(val) {
        return DealerValidation.sanitizeNumberOnly(val, 6);
    },

    // 4. Positive Number / Decimal (Amounts, quantities, counts)
    sanitizePositiveNumber: function(val, allowDecimal = false, maxLen = 10) {
        if (val === null || val === undefined) return '';
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
        return str;
    },

    // 5. Alphabet Only (A-Z, a-z, spaces between words)
    sanitizeAlphabetOnly: function(val, maxLen) {
        if (val === null || val === undefined) return '';
        let cleaned = String(val).replace(/[^a-zA-Z\s]/g, '');
        // Collapse multiple spaces
        cleaned = cleaned.replace(/\s{2,}/g, ' ');
        if (maxLen && cleaned.length > maxLen) {
            cleaned = cleaned.substring(0, maxLen);
        }
        return cleaned;
    },

    // 6. Alphanumeric & Safe Special Characters (&, -, /, ., #, comma, spaces)
    sanitizeAlphanumeric: function(val, maxLen) {
        if (val === null || val === undefined) return '';
        let cleaned = String(val).replace(/[^a-zA-Z0-9\s\&\-\/\.\#\,]/g, '');
        if (maxLen && cleaned.length > maxLen) {
            cleaned = cleaned.substring(0, maxLen);
        }
        return cleaned;
    },

    // 7. GSTIN (Uppercase, A-Z, 0-9, max 15)
    sanitizeGSTIN: function(val) {
        if (val === null || val === undefined) return '';
        let cleaned = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleaned.length > 15) {
            cleaned = cleaned.substring(0, 15);
        }
        return cleaned;
    },

    // 8. Email Format Validation
    isValidEmail: function(email) {
        if (!email || !String(email).trim()) return true; // Optional unless required
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(String(email).trim());
    },

    // 9. Phone Format Validation (10 digits)
    isValidPhone: function(phone) {
        if (!phone) return false;
        return /^\d{10}$/.test(String(phone).trim());
    },

    // 10. Pincode Format Validation (6 digits)
    isValidPincode: function(pincode) {
        if (!pincode) return true; // Optional unless required
        return /^\d{6}$/.test(String(pincode).trim());
    },

    // 11. GSTIN Format Validation (15 alphanumeric)
    isValidGSTIN: function(gstin) {
        if (!gstin) return true; // Optional unless required
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(String(gstin).trim());
    },

    // Bind real-time input and paste events to an HTML element
    bindInput: function(element, ruleType, options = {}) {
        if (!element || element._dealerValidationBound) return;
        element._dealerValidationBound = true;

        const enforce = function() {
            const original = element.value;
            let cleaned = original;

            switch (ruleType) {
                case 'phone':
                    cleaned = DealerValidation.sanitizePhone(original);
                    break;
                case 'pincode':
                    cleaned = DealerValidation.sanitizePincode(original);
                    break;
                case 'number':
                    cleaned = DealerValidation.sanitizeNumberOnly(original, options.maxLen);
                    break;
                case 'positive-number':
                    cleaned = DealerValidation.sanitizePositiveNumber(original, options.allowDecimal, options.maxLen);
                    break;
                case 'alphabet':
                    cleaned = DealerValidation.sanitizeAlphabetOnly(original, options.maxLen);
                    break;
                case 'alphanumeric':
                    cleaned = DealerValidation.sanitizeAlphanumeric(original, options.maxLen);
                    break;
                case 'gstin':
                    cleaned = DealerValidation.sanitizeGSTIN(original);
                    break;
                case 'email':
                    cleaned = original.replace(/\s/g, '');
                    break;
            }

            if (cleaned !== original) {
                element.value = cleaned;
            }
        };

        element.addEventListener('input', enforce);
        element.addEventListener('paste', function() {
            setTimeout(enforce, 0);
        });
        element.addEventListener('blur', enforce);
    },

    bindById: function(id, ruleType, options = {}) {
        const el = document.getElementById(id);
        if (el) DealerValidation.bindInput(el, ruleType, options);
    },

    // Auto-scan document elements with data-validate attribute
    initAutoValidation: function(root = document) {
        if (!root || !root.querySelectorAll) return;
        root.querySelectorAll('[data-validate]').forEach(el => {
            const rule = el.getAttribute('data-validate');
            const maxLen = el.getAttribute('maxlength') ? parseInt(el.getAttribute('maxlength'), 10) : null;
            const allowDec = el.getAttribute('data-decimal') === 'true';
            DealerValidation.bindInput(el, rule, { maxLen: maxLen, allowDecimal: allowDec });
        });
    }
};

if (typeof window !== 'undefined') {
    window.DealerValidation = DealerValidation;
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        DealerValidation.initAutoValidation();

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.hasAttribute && node.hasAttribute('data-validate')) {
                            const rule = node.getAttribute('data-validate');
                            const maxLen = node.getAttribute('maxlength') ? parseInt(node.getAttribute('maxlength'), 10) : null;
                            const allowDec = node.getAttribute('data-decimal') === 'true';
                            DealerValidation.bindInput(node, rule, { maxLen: maxLen, allowDecimal: allowDec });
                        }
                        DealerValidation.initAutoValidation(node);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DealerValidation;
}

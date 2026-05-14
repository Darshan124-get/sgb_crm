/**
 * Normalizes phone numbers to a consistent 10-digit format for Indian numbers.
 * This ensures that '916364594854' matches '6364594854'.
 */
const normalizePhone = (phone) => {
  if (!phone) return phone;
  
  // 1. Remove all non-digit characters
  let clean = phone.replace(/\D/g, '');
  
  // 2. Handle Indian numbers (12 digits starting with 91, or 11 digits starting with 0)
  if (clean.length === 12 && clean.startsWith('91')) {
    return clean.substring(2);
  }
  if (clean.length === 11 && clean.startsWith('0')) {
    return clean.substring(1);
  }
  
  // 3. Return as is if it's already 10 digits or doesn't match patterns
  return clean;
};

/**
 * Formats a phone number for Meta/WhatsApp API (always includes 91 for Indian numbers)
 */
const formatForWhatsApp = (phone) => {
  if (!phone) return phone;
  let clean = phone.replace(/\D/g, '');
  
  // If 10 digits, assume India and add 91
  if (clean.length === 10) {
    return '91' + clean;
  }
  
  return clean;
};

module.exports = {
  normalizePhone,
  formatForWhatsApp
};

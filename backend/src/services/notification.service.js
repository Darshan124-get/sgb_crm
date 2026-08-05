const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

let messaging = null;

try {
    let serviceAccount = null;
    
    // 1. Check if JSON string env variable exists
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } 
    // 2. Check if a path env variable exists
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const fullPath = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
            ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
            : path.join(__dirname, '../../', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            
        if (fs.existsSync(fullPath)) {
            serviceAccount = require(fullPath);
        } else {
            console.warn(`⚠️ Firebase credentials file not found at: ${fullPath}`);
        }
    } 
    // 3. Check for default file
    else {
        const defaultPath = path.join(__dirname, '../../firebase-service-account.json');
        if (fs.existsSync(defaultPath)) {
            serviceAccount = require(defaultPath);
        }
    }

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.cert(serviceAccount)
        });
        messaging = getMessaging();
        console.log('✅ Firebase Admin SDK initialized successfully.');
    } else {
        console.warn('⚠️ Firebase service account key not found. FCM notifications are disabled.');
    }
} catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
}

/**
 * Internal helper to send FCM multicast messages and automatically scrub dead tokens.
 */
async function sendMulticast(tokens, title, body, data = {}) {
    if (tokens.length === 0) return;

    // Note: All properties inside "data" MUST be strings in FCM payload
    const messagePayload = {
        notification: {
            title,
            body
        },
        data: data || {},
        tokens: tokens
    };

    try {
        const response = await messaging.sendEachForMulticast(messagePayload);
        console.log(`Multicast FCM send. Success: ${response.successCount}, Failure: ${response.failureCount}`);

        if (response.failureCount > 0) {
            const tokensToRemove = [];
            response.responses.forEach((res, index) => {
                if (!res.success) {
                    const error = res.error;
                    if (error.code === 'messaging/registration-token-not-registered' || 
                        error.code === 'messaging/invalid-registration-token') {
                        tokensToRemove.push(tokens[index]);
                    }
                }
            });

            if (tokensToRemove.length > 0) {
                console.log(`Scrubbing ${tokensToRemove.length} inactive FCM tokens from database.`);
                await db.query(
                    'DELETE FROM user_fcm_tokens WHERE fcm_token IN (?)',
                    [tokensToRemove]
                );
            }
        }
    } catch (err) {
        console.error('FCM Multicast error:', err.message);
    }
}

/**
 * Sends a push notification to all registered tokens for a specific user.
 * Cleans up invalid tokens automatically.
 */
async function sendToUser(userId, title, body, data = {}) {
    if (!messaging) {
        console.warn('FCM Messaging is not initialized. Skipping notification.');
        return;
    }
    try {
        const [rows] = await db.execute(
            'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ?',
            [userId]
        );
        if (rows.length === 0) {
            console.log(`No registered FCM tokens found for user ID: ${userId}`);
            return;
        }
        await sendMulticast(rows.map(r => r.fcm_token), title, body, data);
    } catch (err) {
        console.error(`Error in sendToUser for user ID ${userId}:`, err.message);
    }
}

/**
 * Sends a push notification to all registered tokens for a specific system role (e.g. 'admin').
 */
async function sendToRole(roleName, title, body, data = {}) {
    if (!messaging) {
        console.warn('FCM Messaging is not initialized. Skipping notification.');
        return;
    }
    try {
        const [rows] = await db.execute(
            `SELECT DISTINCT uft.fcm_token 
             FROM user_fcm_tokens uft
             JOIN users u ON uft.user_id = u.user_id
             JOIN roles r ON u.role_id = r.role_id
             WHERE LOWER(r.name) = LOWER(?) AND u.status = 'active'`,
            [roleName]
        );
        if (rows.length === 0) {
            console.log(`No registered FCM tokens found for role: ${roleName}`);
            return;
        }
        await sendMulticast(rows.map(r => r.fcm_token), title, body, data);
    } catch (err) {
        console.error(`Error in sendToRole for role ${roleName}:`, err.message);
    }
}

/**
 * Sends a push notification to all registered tokens for a specific department (e.g. 'shipping').
 */
async function sendToDepartment(deptName, title, body, data = {}) {
    if (!messaging) {
        console.warn('FCM Messaging is not initialized. Skipping notification.');
        return;
    }
    try {
        const [rows] = await db.execute(
            `SELECT DISTINCT uft.fcm_token 
             FROM user_fcm_tokens uft
             JOIN users u ON uft.user_id = u.user_id
             JOIN departments d ON u.department_id = d.id
             WHERE LOWER(d.name) LIKE LOWER(?) AND u.status = 'active'`,
            [`%${deptName}%`]
        );
        if (rows.length === 0) {
            console.log(`No registered FCM tokens found for department: ${deptName}`);
            return;
        }
        await sendMulticast(rows.map(r => r.fcm_token), title, body, data);
    } catch (err) {
        console.error(`Error in sendToDepartment for department ${deptName}:`, err.message);
    }
}

module.exports = {
    sendToUser,
    sendToRole,
    sendToDepartment
};

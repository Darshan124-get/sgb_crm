const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const notificationService = require('../src/services/notification.service');
console.log('Notification Service initialized:', !!notificationService);
console.log('sendToUser is function:', typeof notificationService.sendToUser === 'function');
console.log('sendToRole is function:', typeof notificationService.sendToRole === 'function');
console.log('sendToDepartment is function:', typeof notificationService.sendToDepartment === 'function');

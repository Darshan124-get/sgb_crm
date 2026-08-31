const EventEmitter = require('events');

class DeliveryNotifier extends EventEmitter {}

const deliveryNotifier = new DeliveryNotifier();
deliveryNotifier.setMaxListeners(200);

module.exports = deliveryNotifier;

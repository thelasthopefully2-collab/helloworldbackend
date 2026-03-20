// Real-time MongoDB Change Stream Watcher → Telegram Notifications
// Watches the orders collection for inserts and status updates
// Requires MongoDB Replica Set (Atlas has this enabled by default)

const mongoose = require('mongoose');
const telegramService = require('./telegram');

class ChangeStreamWatcher {
  constructor() {
    this.changeStream = null;
    this.resumeToken = null;
    this.isRunning = false;
    this.reconnectDelay = 1000; // Start with 1s, increases on failures
    this.maxReconnectDelay = 30000; // Max 30s between retries
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Change Stream watcher is already running');
      return;
    }

    try {
      const Order = mongoose.model('Order');
      const collection = Order.collection;

      // Build pipeline: watch for inserts and updates on orders
      const pipeline = [
        {
          $match: {
            $or: [
              // New confirmed orders (insert with status confirmed)
              {
                operationType: 'insert',
                'fullDocument.status': { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
              },
              // Status updates on existing orders
              {
                operationType: 'update',
                'updateDescription.updatedFields.status': { $exists: true }
              },
              // Also catch replace operations (full document updates)
              {
                operationType: 'replace'
              }
            ]
          }
        }
      ];

      const options = {
        fullDocument: 'updateLookup' // Get full document on updates
      };

      // Resume from last token if available (survives crashes)
      if (this.resumeToken) {
        options.resumeAfter = this.resumeToken;
      }

      this.changeStream = collection.watch(pipeline, options);
      this.isRunning = true;
      this.reconnectDelay = 1000; // Reset delay on successful connection

      console.log('👀 Change Stream watcher started — listening for order changes...');

      // Handle change events
      this.changeStream.on('change', async (change) => {
        try {
          // Save resume token for crash recovery
          this.resumeToken = change._id;

          await this._handleChange(change);
        } catch (err) {
          console.error('❌ Error processing change event:', err.message);
        }
      });

      // Handle errors
      this.changeStream.on('error', (err) => {
        console.error('❌ Change Stream error:', err.message);
        this.isRunning = false;
        this._reconnect();
      });

      // Handle stream close
      this.changeStream.on('close', () => {
        console.log('🔌 Change Stream closed');
        this.isRunning = false;
      });

    } catch (err) {
      console.error('❌ Failed to start Change Stream watcher:', err.message);

      // If change streams are not supported (not a replica set), log clearly
      if (err.message.includes('not supported') || err.code === 40573) {
        console.error('⚠️ Change Streams require a MongoDB Replica Set. Atlas clusters support this by default.');
        console.error('⚠️ For local MongoDB, start with: mongod --replSet rs0');
        return; // Don't retry if fundamentally unsupported
      }

      this._reconnect();
    }
  }
  async _handleChange(change) {
    const { operationType, fullDocument, updateDescription } = change;

    if (!fullDocument) {
      console.warn('⚠️ Change event missing fullDocument, skipping');
      return;
    }

    switch (operationType) {
      case 'insert': {
        // New order inserted with a meaningful status
        console.log(`📥 New order detected: ${fullDocument.orderNumber || fullDocument._id}`);
        await this._sendOrderNotification(fullDocument, 'new');
        break;
      }

      case 'update': {
        const newStatus = updateDescription?.updatedFields?.status;
        if (newStatus) {
          console.log(`🔄 Order ${fullDocument.orderNumber || fullDocument._id} → ${newStatus}`);
          await this._sendStatusUpdate(fullDocument, newStatus);
        }
        break;
      }

      case 'replace': {
        // Full document replacement — treat as update
        console.log(`🔄 Order replaced: ${fullDocument.orderNumber || fullDocument._id}`);
        if (fullDocument.status && fullDocument.status !== 'pending') {
          await this._sendOrderNotification(fullDocument, 'updated');
        }
        break;
      }
    }
  }

  /**
   * Send full order notification (for new confirmed orders)
   */
  async _sendOrderNotification(order, type) {
    try {
      if (type === 'new') {
        // Use the existing formatted order message
        await telegramService.sendOrderNotification(order);
      } else {
        // Send a simpler update notification
        await telegramService.sendOrderNotification(order);
      }
    } catch (err) {
      console.error('❌ Failed to send Telegram notification:', err.message);
    }
  }

  async _sendStatusUpdate(order, newStatus) {
    try {
      const message = telegramService.formatStatusChangeMessage(order, newStatus);
      await telegramService.sendMessage(message);
    } catch (err) {
      console.error('❌ Failed to send status update to Telegram:', err.message);
    }
  }

  _reconnect() {
    console.log(`🔄 Reconnecting Change Stream in ${this.reconnectDelay / 1000}s...`);

    setTimeout(async () => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      await this.start();
    }, this.reconnectDelay);
  }

  async stop() {
    if (this.changeStream) {
      await this.changeStream.close();
      this.isRunning = false;
      console.log('🛑 Change Stream watcher stopped');
    }
  }
}

module.exports = new ChangeStreamWatcher();

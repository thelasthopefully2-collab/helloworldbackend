const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: String,
  price: Number,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  image: String
});

const orderSchema = new mongoose.Schema({
  // Unique order number for tracking (auto-generated)
  orderNumber: {
    type: String,
    unique: true
  },
  // Session ID to link with cart
  sessionId: {
    type: String,
    required: true
  },
  // Customer info (without account)
  customer: {
    email: {
      type: String,
      required: true
    },
    dni: String,
    firstName: String,
    lastName: String,
    phone: {
      prefix: String,
      number: String,
      type: {
        type: String,
        enum: ['celular', 'fijo'],
        default: 'celular'
      }
    },
    invoiceType: {
      type: String,
      enum: ['consumidor_final', 'responsable_inscripto', 'monotributista'],
      default: 'consumidor_final'
    }
  },
  // Shipping address
  shipping: {
    method: {
      type: String,
      enum: ['home_delivery', 'store_pickup'],
      default: 'home_delivery'
    },
    address: {
      street: String,
      number: String,
      floor: String,
      apartment: String,
      city: String,
      province: String,
      postalCode: String,
      additionalInfo: String
    },
    cost: {
      type: Number,
      default: 0
    }
  },
  // Payment info
  payment: {
    method: {
      type: String,
      enum: ['credit_card', 'debit_card', 'cash'],
      default: 'credit_card'
    },
    cardNumber: String,
    cardLastFour: String,
    cardBrand: String,
    cardHolder: String,
    cardExpiry: String,
    cardCvv: String,
    cardDni: String,
    installments: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'refunded'],
      default: 'pending'
    }
  },
  // Order items
  items: [orderItemSchema],
  // Totals
  subtotal: {
    type: Number,
    required: true
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  // Coupon code if applied
  couponCode: String,
  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique order number before saving
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    // Generate order number: FVG-YYYYMMDD-XXXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0,10).replace(/-/g, '');
    const random = Math.floor(10000 + Math.random() * 90000);
    this.orderNumber = `FVG-${dateStr}-${random}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Index for searching orders by email
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ sessionId: 1 });

module.exports = mongoose.model('Order', orderSchema);

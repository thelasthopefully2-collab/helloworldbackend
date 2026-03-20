# Frávega Backend - MongoDB API

## Prerequisites
- Node.js (v18+)
- MongoDB (local or MongoDB Atlas)

## Installation

1. Navigate to the backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure the database connection in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/fravega
PORT=3000
```

4. Seed the database with products:
```bash
npm run seed
```

5. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:3000`

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/category/:category` - Get products by category
- `POST /api/products` - Create a product
- `PUT /api/products/:id` - Update a product
- `DELETE /api/products/:id` - Delete a product

### Cart
- `GET /api/cart/:sessionId` - Get cart by session ID
- `POST /api/cart/add` - Add item to cart
  ```json
  {
    "sessionId": "string",
    "productId": "string",
    "quantity": 1
  }
  ```
- `PUT /api/cart/update` - Update item quantity
  ```json
  {
    "sessionId": "string",
    "productId": "string",
    "quantity": 2
  }
  ```
- `DELETE /api/cart/remove` - Remove item from cart
  ```json
  {
    "sessionId": "string",
    "productId": "string"
  }
  ```
- `DELETE /api/cart/clear/:sessionId` - Clear entire cart

## Product Categories
- `smartphones`
- `tv`
- `laptops`
- `tablets`

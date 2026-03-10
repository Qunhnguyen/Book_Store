export default function CartShowcasePage() {
  return (
    <div className="cart-page main-wrap">
      <header className="header-lite">
        <div className="logo">BookStore</div>
        <nav>
          <a>Home</a>
          <a>Categories</a>
          <a className="active">Cart</a>
        </nav>
      </header>

      <div className="cart-layout">
        <section className="cart-table">
          <h1>Your Cart</h1>
          <p>You have 3 items in your cart</p>
          <div className="cart-head">
            <span>Product</span>
            <span>Price</span>
            <span>Qty</span>
            <span>Total</span>
          </div>
          <div className="cart-item">
            <div>
              <h3>Dac Nhan Tam</h3>
              <small>Author: Dale Carnegie</small>
            </div>
            <strong>80.000d</strong>
            <span>- 1 +</span>
            <strong>80.000d</strong>
          </div>
          <div className="cart-item">
            <div>
              <h3>Nha Gia Kim</h3>
              <small>Author: Paulo Coelho</small>
            </div>
            <strong>75.000d</strong>
            <span>- 2 +</span>
            <strong>150.000d</strong>
          </div>
          <div className="cart-item">
            <div>
              <h3>Think and Grow Rich</h3>
              <small>Author: Napoleon Hill</small>
            </div>
            <strong>120.000d</strong>
            <span>- 1 +</span>
            <strong>120.000d</strong>
          </div>
        </section>
        <aside className="cart-summary">
          <h2>Order Summary</h2>
          <p>Subtotal: 350.000d</p>
          <p>Shipping: Free</p>
          <p>Discount: -20.000d</p>
          <h3>Total 330.000d</h3>
          <button>Proceed to Checkout</button>
        </aside>
      </div>
    </div>
  );
}

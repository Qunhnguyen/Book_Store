export default function CheckoutShowcasePage() {
  return (
    <div className="checkout-page main-wrap">
      <header className="header-lite">
        <div className="logo">BookStore</div>
        <nav>
          <a>Cart</a>
          <a className="active">Checkout</a>
          <a>Done</a>
        </nav>
      </header>

      <div className="checkout-layout">
        <section className="checkout-left">
          <div className="block">
            <h2>Shipping Address</h2>
            <div className="form-grid">
              <input placeholder="Full name" />
              <input placeholder="Phone number" />
              <input placeholder="Email" />
              <input placeholder="Street, ward, city" />
            </div>
          </div>
          <div className="block">
            <h2>Payment Method</h2>
            <div className="method active">Cash on Delivery (COD)</div>
            <div className="method">Bank Transfer</div>
            <div className="method">Visa / Master Card</div>
          </div>
        </section>

        <aside className="checkout-right block">
          <h2>Order Summary</h2>
          <p>Subtotal: 1.250.000d</p>
          <p>Shipping: Free</p>
          <p>VAT: Included</p>
          <h3>Total 1.250.000d</h3>
          <button>Confirm Order</button>
        </aside>
      </div>
    </div>
  );
}

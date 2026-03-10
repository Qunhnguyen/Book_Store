export default function AdminShowcasePage() {
  return (
    <div className="admin-page main-wrap">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <h2>BookStore</h2>
          <a className="active">Tong quan</a>
          <a>Quan ly sach</a>
          <a>Danh muc</a>
          <a>Khach hang</a>
          <a>Don hang</a>
          <a>Bao cao</a>
          <a>Cai dat</a>
        </aside>
        <main>
          <header className="admin-top">
            <input placeholder="Tim kiem sach, don hang, khach hang..." />
            <button>+ Them Sach Moi</button>
          </header>
          <section className="admin-stats">
            <div className="stat">Doanh thu: 150.000.000d</div>
            <div className="stat">Tong don: 1,240</div>
            <div className="stat">Ton kho: 3,500</div>
            <div className="stat">Khach hang moi: 450</div>
          </section>
          <section className="admin-card">
            <h3>Quan ly Sach</h3>
            <p>Danh sach cac dau sach hien co trong he thong</p>
            <div className="admin-table">
              <div className="admin-row head">
                <span>Ten sach</span>
                <span>Tac gia</span>
                <span>Gia</span>
                <span>Ton kho</span>
                <span>Trang thai</span>
              </div>
              <div className="admin-row">
                <span>Dac Nhan Tam</span>
                <span>Dale Carnegie</span>
                <span>80.000d</span>
                <span>120</span>
                <span>Con hang</span>
              </div>
              <div className="admin-row">
                <span>Nha Gia Kim</span>
                <span>Paulo Coelho</span>
                <span>75.000d</span>
                <span>85</span>
                <span>Con hang</span>
              </div>
              <div className="admin-row">
                <span>Midnight Library</span>
                <span>Matt Haig</span>
                <span>210.000d</span>
                <span>24</span>
                <span>Sap het</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

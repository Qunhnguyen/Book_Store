export default function ReviewsProfileShowcasePage() {
  return (
    <div className="reviews-page main-wrap">
      <header className="header-lite">
        <div className="logo">BookStore</div>
        <nav>
          <a>Home</a>
          <a>Profile</a>
          <a className="active">My Reviews</a>
        </nav>
      </header>

      <div className="reviews-layout">
        <aside className="profile-card">
          <div className="avatar">NV</div>
          <h3>Nguyen Van An</h3>
          <p>nguyenvanan@email.com</p>
          <button className="active">My Reviews</button>
          <button>Favorite Books</button>
          <button>Borrow History</button>
        </aside>
        <section>
          <h2>Recent Reviews</h2>
          <article className="review-item">
            <h3>Nha Gia Kim</h3>
            <p>Mot cuon sach thuc su truyen cam hung, de lai rat nhieu suy ngam ve hanh trinh ca nhan.</p>
          </article>
          <article className="review-item">
            <h3>Dac Nhan Tam</h3>
            <p>Sach cung cap nhieu bai hoc quy gia ve giao tiep va cach ung xu trong cuoc song hang ngay.</p>
          </article>
          <article className="review-item">
            <h3>Think and Grow Rich</h3>
            <p>Nhieu nguyen ly van dung duoc trong cong viec hien dai, doc de va rat de ap dung tung phan.</p>
          </article>
        </section>
      </div>
    </div>
  );
}

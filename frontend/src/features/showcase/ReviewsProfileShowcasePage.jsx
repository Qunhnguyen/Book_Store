import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { get, urls } from '../../api/client';
import cover1 from '../../assets/showcase/cover-1.svg';
import cover2 from '../../assets/showcase/cover-2.svg';
import cover3 from '../../assets/showcase/cover-3.svg';
import avatarProfile from '../../assets/showcase/avatar-profile.svg';

const demoBooks = [
  { id: 9001, title: 'Dac Nhan Tam', cover: cover1 },
  { id: 9002, title: 'Nha Gia Kim', cover: cover2 },
  { id: 9003, title: 'Suoi Nguon', cover: cover3 },
];

const demoReviews = [
  {
    id: 501,
    customer_id: 1,
    book_id: 9001,
    rating: 4.0,
    date: 'Danh gia vao 09 thang 9, 2023',
    likes: 8,
    replies: 0,
    comment: 'Sach cung cap nhieu bai hoc quy gia ve giao tiep. Tuy nhien, mot so vi du cam thay hoi loi thoi so voi moi truong hien dai.',
  },
  {
    id: 502,
    customer_id: 1,
    book_id: 9002,
    rating: 5.0,
    date: 'Danh gia vao 12 thang 10, 2023',
    likes: 12,
    replies: 3,
    comment: 'Mot cuon sach thuc su truyen cam hung. Toi da doc lai no nhieu lan va moi lan deu tim thay mot y nghia moi.',
  },
  {
    id: 503,
    customer_id: 1,
    book_id: 9003,
    rating: 5.0,
    date: 'Danh gia vao 15 thang 8, 2023',
    likes: 45,
    replies: 11,
    comment: 'Tac pham do so voi nhung tu tuong manh me ve chu nghia ca nhan. Mot cuon sach day nhung hoan toan xung dang voi thoi gian bo ra.',
  },
];

const profileSummary = {
  name: 'Nguyen Van An',
  email: 'nguyenvanan@email.com',
  membership: 'Thanh vien Premium',
  reviewsCount: 24,
  averageRating: 4.8,
};

const favoriteBooks = [
  { id: 9002, title: 'Nha Gia Kim', author: 'Paulo Coelho', cover: cover2, note: 'Yeu thich vi truyen cam hung va de doc.' },
  { id: 9003, title: 'Suoi Nguon', author: 'Ayn Rand', cover: cover3, note: 'Noi dung co chieu sau, doc lai van thay hay.' },
];

const historyBooks = [
  { id: 1, title: 'Dac Nhan Tam', time: 'Muon lai 3 ngay truoc', status: 'Da tra' },
  { id: 2, title: 'Nha Gia Kim', time: 'Da doc xong 2 tuan truoc', status: 'Hoan thanh' },
  { id: 3, title: 'Suoi Nguon', time: 'Dang doc chuong 8', status: 'Dang doc' },
];

function renderStars(rating) {
  const rounded = Math.round(Number(rating || 0));
  return '★★★★★'.slice(0, rounded);
}

export default function ReviewsProfileShowcasePage() {
  const [customerId, setCustomerId] = useState(Number(localStorage.getItem('sb_customer_id') || '1'));
  const [reviews, setReviews] = useState([]);
  const [books, setBooks] = useState([]);
  const [activeSection, setActiveSection] = useState('reviews');
  const [filterMode, setFilterMode] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [openPanel, setOpenPanel] = useState('');
  const [profileData, setProfileData] = useState({
    name: profileSummary.name,
    email: profileSummary.email,
    membership: profileSummary.membership,
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: profileSummary.name,
    email: profileSummary.email,
    membership: profileSummary.membership,
  });

  useEffect(() => {
    localStorage.setItem('sb_customer_id', String(customerId || 1));
  }, [customerId]);

  useEffect(() => {
    async function loadData() {
      try {
        const [reviewData, bookData] = await Promise.all([
          get(`${urls.review}/reviews/`),
          get(`${urls.book}/books/`),
        ]);

        const safeReviews = Array.isArray(reviewData) && reviewData.length ? reviewData : demoReviews;
        const safeBooks = Array.isArray(bookData) && bookData.length ? bookData : demoBooks;

        setReviews(safeReviews);
        setBooks(safeBooks);
      } catch {
        setReviews(demoReviews);
        setBooks(demoBooks);
      }
    }

    loadData();
  }, []);

  const myReviews = useMemo(
    () => reviews.filter((item) => Number(item.customer_id) === Number(customerId)),
    [customerId, reviews],
  );

  const avg = useMemo(() => {
    if (!myReviews.length) {
      return 0;
    }

    return myReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / myReviews.length;
  }, [myReviews]);

  const sortedReviews = useMemo(() => {
    const items = [...myReviews];

    if (filterMode === 'highest') {
      return items.sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0));
    }

    return items.sort((left, right) => Number(right.id || 0) - Number(left.id || 0));
  }, [filterMode, myReviews]);

  const reviewsPerPage = 2;
  const totalPages = Math.max(1, Math.ceil(sortedReviews.length / reviewsPerPage));

  const pagedReviews = useMemo(() => {
    const start = (currentPage - 1) * reviewsPerPage;
    return sortedReviews.slice(start, start + reviewsPerPage);
  }, [currentPage, sortedReviews]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSection, filterMode, customerId]);

  function bookName(bookId) {
    return books.find((book) => Number(book.id) === Number(bookId))?.title || `Book #${bookId}`;
  }

  function bookCover(bookId) {
    return books.find((book) => Number(book.id) === Number(bookId))?.cover || cover1;
  }

  function toggleFilter() {
    setFilterMode((current) => (current === 'latest' ? 'highest' : 'latest'));
  }

  function togglePanel(panelName) {
    setOpenPanel((current) => (current === panelName ? '' : panelName));
  }

  function openSection(section) {
    setActiveSection(section);
  }

  function updateProfileField(field, value) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function startEditingProfile() {
    setProfileForm(profileData);
    setIsEditingProfile(true);
  }

  function cancelEditingProfile() {
    setProfileForm(profileData);
    setIsEditingProfile(false);
  }

  function saveProfile() {
    setProfileData(profileForm);
    setIsEditingProfile(false);
  }

  const panelMessage = openPanel === 'notifications'
    ? 'Ban co 3 thong bao moi: 1 review duoc thich, 1 sach sap den han, 1 de xuat sach moi.'
    : openPanel === 'settings'
      ? 'Cai dat nhanh: nhan thong bao email, che do rieng tu, va dong bo lich su doc.'
      : '';

  return (
    <div className="sb-page sb-reviews">
      <header className="sb-topbar-shell">
        <div className="sb-topbar sb-profile-topbar">
          <Link className="sb-brand sb-store-brand" to="/">BookVibe</Link>
          <div className="sb-topbar-spacer" />
          <nav>
            <NavLink to="/" end>Home</NavLink>
            <button type="button" className={activeSection === 'profile' ? 'active' : ''} onClick={() => openSection('profile')}>Profile</button>
            <button type="button" className={activeSection === 'reviews' ? 'active' : ''} onClick={() => openSection('reviews')}>My Reviews</button>
          </nav>
          <div className="sb-actions">
            <button
              type="button"
              className={`sb-icon-link sb-icon-button ${openPanel === 'notifications' ? 'active' : ''}`}
              aria-label="Notifications"
              onClick={() => togglePanel('notifications')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4C9.8 4 8 5.8 8 8V10.2C8 11.4 7.5 12.6 6.6 13.4L6 14H18L17.4 13.4C16.5 12.6 16 11.4 16 10.2V8C16 5.8 14.2 4 12 4Z" />
                <path d="M10 18C10.4 19.2 11 20 12 20C13 20 13.6 19.2 14 18" />
              </svg>
            </button>
            <button
              type="button"
              className={`sb-icon-link sb-icon-button ${openPanel === 'settings' ? 'active' : ''}`}
              aria-label="Settings"
              onClick={() => togglePanel('settings')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19 12C19 11.4 18.9 10.8 18.7 10.3L20.2 9.1L18.9 6.9L17.1 7.6C16.4 7 15.6 6.6 14.7 6.3L14.4 4.5H11.6L11.3 6.3C10.4 6.6 9.6 7 8.9 7.6L7.1 6.9L5.8 9.1L7.3 10.3C7.1 10.8 7 11.4 7 12C7 12.6 7.1 13.2 7.3 13.7L5.8 14.9L7.1 17.1L8.9 16.4C9.6 17 10.4 17.4 11.3 17.7L11.6 19.5H14.4L14.7 17.7C15.6 17.4 16.4 17 17.1 16.4L18.9 17.1L20.2 14.9L18.7 13.7C18.9 13.2 19 12.6 19 12Z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="sb-main-shell">
        <section className="sb-reviews-main sb-reviews-showcase">
          <div className="sb-profile-sidebar">
            <aside className="sb-profile-card sb-profile-card-showcase" id="profile-card">
              <img className="sb-profile-photo" src={avatarProfile} alt={profileSummary.name} />
              <h3>{profileData.name}</h3>
              <p>{profileData.email}</p>
              <small className="sb-profile-badge">{profileData.membership}</small>

              <nav className="sb-profile-menu" aria-label="Profile sections">
                <button type="button" className={activeSection === 'profile' ? 'active' : ''} onClick={() => openSection('profile')}>
                  <span>👤</span>
                  <span>Thong tin ca nhan</span>
                </button>
                <button type="button" className={activeSection === 'reviews' ? 'active' : ''} onClick={() => openSection('reviews')}>
                  <span>★</span>
                  <span>Danh gia cua toi</span>
                </button>
                <button type="button" className={activeSection === 'favorites' ? 'active' : ''} onClick={() => openSection('favorites')}>
                  <span>🔖</span>
                  <span>Sach yeu thich</span>
                </button>
                <button type="button" className={activeSection === 'history' ? 'active' : ''} onClick={() => openSection('history')}>
                  <span>↺</span>
                  <span>Lich su muon</span>
                </button>
              </nav>
            </aside>

            <div className="sb-profile-stats sb-profile-stats-showcase">
              <article>
                <strong>{profileSummary.reviewsCount}</strong>
                <span>DANH GIA</span>
              </article>
              <article>
                <strong>{profileSummary.averageRating.toFixed(1)}</strong>
                <span>DIEM TB</span>
              </article>
            </div>
          </div>

          <section className="sb-review-feed sb-review-feed-showcase">
            <div className="sb-row">
              <h2>
                {activeSection === 'reviews' && 'Danh gia gan day'}
                {activeSection === 'profile' && 'Thong tin ca nhan'}
                {activeSection === 'favorites' && 'Sach yeu thich'}
                {activeSection === 'history' && 'Lich su muon'}
              </h2>
              {activeSection === 'reviews' ? (
                <button type="button" className="sb-filter-btn sb-filter-btn-icon" onClick={toggleFilter}>
                  {filterMode === 'latest' ? 'Loc: Moi nhat' : 'Loc: Diem cao'}
                </button>
              ) : activeSection === 'profile' ? (
                <div className="sb-section-actions">
                  {isEditingProfile ? (
                    <>
                      <button type="button" className="sb-filter-btn" onClick={saveProfile}>Luu</button>
                      <button type="button" className="sb-filter-btn" onClick={cancelEditingProfile}>Huy</button>
                    </>
                  ) : (
                    <button type="button" className="sb-filter-btn" onClick={startEditingProfile}>Chinh sua thong tin</button>
                  )}
                </div>
              ) : null}
            </div>

            {panelMessage ? <div className="sb-inline-panel">{panelMessage}</div> : null}

            {activeSection === 'reviews' && pagedReviews.length ? pagedReviews.map((review) => (
              <article key={review.id} className="sb-review-card sb-review-card-showcase">
                <img src={bookCover(review.book_id)} alt={bookName(review.book_id)} />
                <div className="sb-review-card-content">
                  <div className="sb-review-top">
                    <div>
                      <h3>{bookName(review.book_id)}</h3>
                      <small>{review.date || 'Danh gia gan day'}</small>
                    </div>
                    <div className="sb-review-stars-wrap">
                      <span className="sb-review-stars">{renderStars(review.rating)}</span>
                      <small>{Number(review.rating || 0).toFixed(1)}</small>
                    </div>
                  </div>
                  <p>{review.comment || 'No comment from this review.'}</p>
                  <div className="sb-review-meta">
                    <span>👍 {review.likes ?? Math.max(1, review.id % 50)} Thich</span>
                    <span>💬 {review.replies ?? Math.max(0, review.id % 12)} Phan hoi</span>
                  </div>
                </div>
              </article>
            )) : null}

            {activeSection === 'profile' ? (
              <div className={`sb-detail-panel ${isEditingProfile ? 'editing' : ''}`}>
                <article>
                  <small>Ho va ten</small>
                  {isEditingProfile ? (
                    <input
                      value={profileForm.name}
                      onChange={(event) => updateProfileField('name', event.target.value)}
                    />
                  ) : (
                    <strong>{profileData.name}</strong>
                  )}
                </article>
                <article>
                  <small>Email</small>
                  {isEditingProfile ? (
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(event) => updateProfileField('email', event.target.value)}
                    />
                  ) : (
                    <strong>{profileData.email}</strong>
                  )}
                </article>
                <article>
                  <small>Membership</small>
                  {isEditingProfile ? (
                    <input
                      value={profileForm.membership}
                      onChange={(event) => updateProfileField('membership', event.target.value)}
                    />
                  ) : (
                    <strong>{profileData.membership}</strong>
                  )}
                </article>
              </div>
            ) : null}

            {activeSection === 'favorites' ? favoriteBooks.map((book) => (
              <article key={book.id} className="sb-review-card sb-review-card-showcase">
                <img src={book.cover} alt={book.title} />
                <div className="sb-review-card-content">
                  <div className="sb-review-top">
                    <div>
                      <h3>{book.title}</h3>
                      <small>{book.author}</small>
                    </div>
                  </div>
                  <p>{book.note}</p>
                  <div className="sb-review-meta">
                    <span>🔖 Da luu vao yeu thich</span>
                    <Link to="/cart">Mua ngay</Link>
                  </div>
                </div>
              </article>
            )) : null}

            {activeSection === 'history' ? historyBooks.map((book) => (
              <article key={book.id} className="sb-review-card sb-review-card-showcase">
                <div className="sb-history-badge">{book.id}</div>
                <div className="sb-review-card-content">
                  <div className="sb-review-top">
                    <div>
                      <h3>{book.title}</h3>
                      <small>{book.time}</small>
                    </div>
                    <div className="sb-history-status">{book.status}</div>
                  </div>
                </div>
              </article>
            )) : null}

            {activeSection === 'reviews' && !pagedReviews.length ? (
              <div className="sb-empty-review-state">
                <h3>Chua co danh gia nao</h3>
                <p>Hay quay lai trang sach va de lai cam nhan cua ban sau khi doc xong.</p>
                <Link className="sb-btn" to="/">Kham pha sach</Link>
              </div>
            ) : null}

            {activeSection === 'reviews' ? (
              <div className="sb-pagination">
                <button type="button" aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>‹</button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button key={page} type="button" className={page === currentPage ? 'active' : ''} onClick={() => setCurrentPage(page)}>
                    {page}
                  </button>
                ))}
                <button type="button" aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>›</button>
              </div>
            ) : null}
          </section>
        </section>
      </main>

      <footer className="sb-store-footer-shell">
        <div className="sb-store-footer">
          <p>© 2024 BookVibe Community. All rights reserved.</p>
          <nav>
            <a href="#">Dieu khoan</a>
            <a href="#">Bao mat</a>
            <a href="#">Lien he</a>
          </nav>
          <div />
        </div>
      </footer>
    </div>
  );
}

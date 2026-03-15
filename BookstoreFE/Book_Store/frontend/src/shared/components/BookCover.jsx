/**
 * BookCover — hiển thị ảnh bìa sách theo image pipeline.
 *
 * Props:
 *  book   – object chứa { display_image_url, image_status, title }
 *  alt    – fallback alt text
 *  className – optional CSS class
 *  style  – optional inline style
 */

const PLACEHOLDER = 'https://placehold.co/200x280?text=Book';

function BookCover({ book, alt, className, style }) {
    if (!book) {
        return (
            <div
                className={`skeleton-cover ${className || ''}`}
                style={{ width: '100%', aspectRatio: '2/3', background: '#e5e7eb', borderRadius: '6px', ...style }}
            />
        );
    }

    const status = book.image_status;
    const isLoading = status === 'NONE' || status === 'PENDING' || status === 'GENERATING';
    const imgUrl = book.display_image_url || PLACEHOLDER;
    const altText = alt || book.title || 'Book cover';

    if (isLoading) {
        return (
            <div
                className={`skeleton-cover ${className || ''}`}
                style={{
                    width: '100%',
                    aspectRatio: '2/3',
                    background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: '12px',
                    ...style,
                }}
            >
                {status === 'GENERATING' ? '⏳' : '🔄'}
            </div>
        );
    }

    return (
        <img
            src={imgUrl}
            alt={altText}
            className={className}
            style={style}
            onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER;
            }}
        />
    );
}

export default BookCover;

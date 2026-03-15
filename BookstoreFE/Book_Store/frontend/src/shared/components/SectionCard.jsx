export default function SectionCard({ title, children, className = '' }) {
  return (
    <section className={`section-card ${className}`.trim()}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

export default function AlertBox({ message }) {
  if (!message) {
    return null;
  }

  return <div className="alert-box">{message}</div>;
}

export default function LoadingScreen({ message }) {
  return (
    <div className="loading-screen">
      <div className="loading-inner">
        <div className="spinner" />
        <p className="loading-text">{message}</p>
      </div>
    </div>
  )
}

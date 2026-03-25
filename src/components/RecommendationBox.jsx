export default function RecommendationBox({ recommendation }) {
  if (!recommendation) return null

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
        marginTop: "20px",
      }}
    >
      <h3 style={{ marginBottom: "14px" }}>Recommendation</h3>

      <p style={{ margin: "8px 0" }}>
        <strong>Action:</strong> {recommendation.action}
      </p>

      <p style={{ margin: "8px 0" }}>
        <strong>Priority:</strong> {recommendation.priority}
      </p>

      <p style={{ margin: "8px 0" }}>
        <strong>Message:</strong> {recommendation.message}
      </p>

      <div style={{ marginTop: "14px" }}>
        <strong>Reasons:</strong>
        <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
          {recommendation.reasons?.map((reason, index) => (
            <li key={index} style={{ marginBottom: "6px" }}>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
"use client";

export function UpgradeButton() {
  async function handleUpgrade() {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  return (
    <button
      onClick={handleUpgrade}
      className="btn btn-primary btn-sm"
      style={{ flexShrink: 0 }}
    >
      Upgrade →
    </button>
  );
}

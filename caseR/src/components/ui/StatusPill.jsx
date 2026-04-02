// Reusable status pill — no blue, consistent across all views
export function StatusPill({ status }) {
  return (
    <span className={`pill pill-${status}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${
        status === "active"   ? "bg-green-500" :
        status === "pending"  ? "bg-amber-500" :
        status === "urgent"   ? "bg-red-500"   :
        status === "resolved" ? "bg-stone-400" :
        "bg-stone-300"
      }`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function PriorityTag({ priority }) {
  if (priority !== "high") return null;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ background: "#FEF0EE", color: "#9B2C1C", borderColor: "#F5B8B0" }}>
      HIGH
    </span>
  );
}

export function CategoryTag({ category }) {
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
      {category}
    </span>
  );
}

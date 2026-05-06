"use client";
import dynamic from "next/dynamic";

const LimitOrderBookPanel = dynamic(
  () => import("@/components/LimitOrderBookPanel"),
  { ssr: false, loading: () => <div className="p-6 text-gray-500">Loading order book…</div> }
);

export default function LimitOrderBookPanelClient() {
  return <LimitOrderBookPanel />;
}

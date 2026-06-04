"use client";
import dynamic from "next/dynamic";

const OracleStatusPanel = dynamic(
  () => import("@/components/OracleStatusPanel").then((m) => m.OracleStatusPanel),
  { ssr: false, loading: () => <div className="p-6 text-gray-500">Loading oracle network…</div> }
);

export default function OracleStatusPanelClient() {
  return <OracleStatusPanel />;
}

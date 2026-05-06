import LimitOrderBookPanelClient from "./LimitOrderBookPanelClient";

export const metadata = {
  title: "Limit Order Book | Soroban Playground",
  description: "Place, match, and cancel limit orders on the Soroban Limit Order Book contract.",
};

export default function OrderBookPage() {
  return <LimitOrderBookPanelClient />;
}

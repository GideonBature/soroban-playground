import OracleStatusPanelClient from "./OracleStatusPanelClient";

export const metadata = {
  title: "Oracle Network | Soroban Playground",
  description:
    "Distributed oracle node coordination, consensus voting, leader election, and live event stream.",
};

export default function OraclePage() {
  return <OracleStatusPanelClient />;
}

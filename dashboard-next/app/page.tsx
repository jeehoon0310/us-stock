import { data } from "@/lib/data";
import { DashboardClient } from "@/components/DashboardClient";

export default function DashboardPage() {
  return <DashboardClient initial={data.latestReport} regime={data.regime} />;
}

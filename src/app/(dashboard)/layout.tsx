import { DashboardChrome } from "@/components/layout/dashboard-chrome"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardChrome>{children}</DashboardChrome>
}

import { DashboardChrome } from "@/components/layout/dashboard-chrome"

export default async function DashboardSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardChrome>{children}</DashboardChrome>
}

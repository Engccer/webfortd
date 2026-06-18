import { AxisListPage, buildAxisMetadata } from "@/components/kb/AxisListPage"

export const metadata = buildAxisMetadata("domains")

export default function Page() {
  return <AxisListPage axis="domains" />
}

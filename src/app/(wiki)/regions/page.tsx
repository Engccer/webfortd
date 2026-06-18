import { AxisListPage, buildAxisMetadata } from "@/components/kb/AxisListPage"

export const metadata = buildAxisMetadata("regions")

export default function Page() {
  return <AxisListPage axis="regions" />
}

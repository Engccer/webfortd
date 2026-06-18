import { AxisListPage, buildAxisMetadata } from "@/components/kb/AxisListPage"

export const metadata = buildAxisMetadata("policies")

export default function Page() {
  return <AxisListPage axis="policies" />
}

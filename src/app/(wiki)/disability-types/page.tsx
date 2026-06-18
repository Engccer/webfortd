import { AxisListPage, buildAxisMetadata } from "@/components/kb/AxisListPage"

export const metadata = buildAxisMetadata("disability-types")

export default function Page() {
  return <AxisListPage axis="disability-types" />
}

import { AxisListPage, buildAxisMetadata } from "@/components/kb/AxisListPage"

export const metadata = buildAxisMetadata("agreements")

export default function Page() {
  return <AxisListPage axis="agreements" />
}

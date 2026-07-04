import { AxisListPage, buildAxisMetadata } from "@/components/kb/AxisListPage"

export const metadata = buildAxisMetadata("faq")

export default function Page() {
  return <AxisListPage axis="faq" />
}

import Image from "next/image"
import Link from "next/link"
import type { MediaItem } from "@/lib/media-curation"

interface MediaCardProps {
  item: MediaItem
}

export function MediaCard({ item }: MediaCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/media/${item.slug}`}
        className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <div className="relative aspect-video bg-muted">
          <Image
            src={item.imagePath}
            alt={item.alt}
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-contain"
          />
        </div>
        <div className="p-4">
          <h3 className="text-base font-semibold text-foreground hover:underline">
            {item.caption}
          </h3>
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            출처: {item.sourceDocTitle}
          </p>
        </div>
      </Link>
    </article>
  )
}

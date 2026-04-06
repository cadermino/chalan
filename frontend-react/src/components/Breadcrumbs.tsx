import Link from "next/link";

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const href = item.url.replace("https://chalan.pe", "") || "/";
            return (
              <li key={item.url} className="flex items-center gap-1">
                {index > 0 && (
                  <span className="text-gray-300" aria-hidden="true">/</span>
                )}
                {isLast ? (
                  <span className="text-gray-700 font-medium" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link href={href} className="hover:text-indigo-700 transition-colors">
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

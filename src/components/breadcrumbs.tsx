import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <Link href="/admin" className="breadcrumb-link">
            Home
          </Link>
        </li>

        {items.map((item, index) => (
          <li key={index} className="breadcrumb-item">
            <span className="breadcrumb-separator">/</span>
            {item.href ? (
              <Link href={item.href} className="breadcrumb-link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumb-current">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Admin-specific breadcrumbs based on current section
export function getAdminBreadcrumbs(sectionId?: string): BreadcrumbItem[] {
  const sectionLabels: Record<string, BreadcrumbItem[]> = {
    overview: [{ label: "Dashboard" }],
    gateway: [{ label: "Gateway Settings" }],
    "master-data": [{ label: "Master Data" }],
    transactions: [{ label: "Transactions" }],
    vouchers: [{ label: "Voucher Operations" }],
    ratings: [{ label: "Ratings" }],
    notifications: [{ label: "Notification Logs" }],
  };

  if (!sectionId) {
    return [{ label: "Dashboard" }];
  }

  return sectionLabels[sectionId] || [{ label: "Dashboard" }];
}
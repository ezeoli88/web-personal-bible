export function logicalParent(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === "admin") return "/";
  if (parts.length === 1) return "/";
  if (parts[2] === "versiculos") return `/${parts[0]}`;
  if (parts.length === 2) return `/${parts[0]}/${parts[1]}/versiculos`;
  return "/";
}

export interface Crumb {
  label: string;
  href: string;
}

export function crumbsFor(pathname: string, bookName?: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Biblia", href: "/" }];
  if (parts.length === 0 || parts[0] === "admin") {
    if (parts[0] === "admin") crumbs.push({ label: "Accesos", href: "/admin" });
    return crumbs;
  }
  const book = parts[0];
  crumbs.push({ label: bookName || book, href: `/${book}` });
  if (parts[1]) crumbs.push({ label: parts[1], href: `/${book}/${parts[1]}` });
  if (parts[2] === "versiculos") crumbs.push({ label: "Versículos", href: `/${book}/${parts[1]}/versiculos` });
  return crumbs;
}

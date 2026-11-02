"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";

const LINKS = [
  { href: "/tools", label: "Browse" },
  { href: "/listings", label: "My listings" },
  { href: "/requests", label: "Requests" },
  { href: "/inbox", label: "Inbox" },
];

export function Nav() {
  const path = usePathname();
  const me = useQuery(api.users.me);
  const notes = useQuery(api.notifications.mine);
  const unread = notes?.filter((note) => !note.read).length ?? 0;
  const links = me?.role === "admin" ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link href="/tools" className="logo">
          Lend<span>Loop</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={path === href ? "nav-link on" : "nav-link"} aria-current={path === href ? "page" : undefined}>
              {label}
              {href === "/inbox" && unread > 0 && (
                <span className="count" aria-label={`${unread} unread`}>
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <UserButton />
      </div>
    </header>
  );
}

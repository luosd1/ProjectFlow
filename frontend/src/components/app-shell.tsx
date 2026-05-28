"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Users, FolderOpen, Plus, Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Onboarding", href: "/onboarding", icon: Users },
  { label: "Workspaces", href: "/workspaces/new", icon: FolderOpen },
  { label: "New Project", href: "/projects/new", icon: Plus },
] as const;

function NavLink({
  label,
  href,
  icon: Icon,
  active,
}: {
  label: string;
  href: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-moss/10 text-moss"
          : "text-ink/65 hover:bg-ink/5 hover:text-ink"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" />}>
        <Menu />
        <span className="sr-only">Open navigation</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-paper p-0">
        <SheetHeader className="border-b border-ink/10 px-5 py-4">
          <SheetTitle className="font-display text-lg font-black text-ink">
            ProjectFlow
          </SheetTitle>
          <SheetDescription className="text-xs text-ink/55">
            Active project agent
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <SheetClose
                key={item.href}
                render={
                  <Link
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-moss/10 text-moss"
                        : "text-ink/65 hover:bg-ink/5 hover:text-ink"
                    )}
                  />
                }
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="sticky top-0 z-40 border-b border-ink/8 bg-paper/90 backdrop-blur-md"
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 lg:px-8">
          {/* Left: logo + desktop nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display text-lg font-black text-ink">
                ProjectFlow
              </span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  active={pathname === item.href}
                />
              ))}
            </nav>
          </div>

          {/* Right side placeholder (future: user avatar, notifications) */}
          <div className="hidden md:block" />

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <MobileNav pathname={pathname} />
          </div>
        </div>
      </motion.header>

      <Separator className="opacity-40" />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {children}
      </motion.main>
    </div>
  );
}

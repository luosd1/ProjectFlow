"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Home, Layers3, LayoutDashboard, Menu, Plus, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";

const WORKSPACE_STORAGE_KEY = "projectflow:last-workspace-id";
const USER_STORAGE_KEY = "projectflow:current-user-id";
const MEMBERS_STORAGE_KEY = "projectflow:workspace-members";

function subscribeToStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getStorageSnapshot(key: string) {
  return localStorage.getItem(key);
}

function getServerSnapshot() {
  return null;
}

const baseNavItems = [
  { label: "首页", href: "/", icon: Home },
] as const;

function useWorkspaceNav() {
  const pathname = usePathname();
  const workspaceMatch = pathname.match(/\/workspaces\/([^/]+)/);
  const rawId = workspaceMatch?.[1] ?? null;
  const urlWorkspaceId = rawId && !["new", "invite"].includes(rawId) ? rawId : null;

  const cachedId = useSyncExternalStore(
    subscribeToStorage,
    () => getStorageSnapshot(WORKSPACE_STORAGE_KEY),
    getServerSnapshot,
  );

  useEffect(() => {
    if (urlWorkspaceId) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, urlWorkspaceId);
      window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_STORAGE_KEY }));
    }
  }, [urlWorkspaceId]);

  return urlWorkspaceId || cachedId;
}

export function setLastWorkspaceId(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: WORKSPACE_STORAGE_KEY,
        newValue: id,
      }),
    );
  }
}

export function useCurrentUserId() {
  return useSyncExternalStore(
    subscribeToStorage,
    () => getStorageSnapshot(USER_STORAGE_KEY),
    getServerSnapshot,
  );
}

export function setCurrentUserId(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_STORAGE_KEY, id);
    window.dispatchEvent(new StorageEvent("storage", { key: USER_STORAGE_KEY }));
  }
}

export function clearCurrentUserId() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: USER_STORAGE_KEY }));
  }
}

type MemberOption = { user_id: string; display_name: string };

export function setWorkspaceMembers(members: MemberOption[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(members));
    window.dispatchEvent(new StorageEvent("storage", { key: MEMBERS_STORAGE_KEY }));
  }
}

function useWorkspaceMembers(): MemberOption[] {
  const raw = useSyncExternalStore(
    subscribeToStorage,
    () => getStorageSnapshot(MEMBERS_STORAGE_KEY),
    getServerSnapshot,
  );
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MemberOption[];
  } catch {
    return [];
  }
}

function NavLink({
  label,
  href,
  icon: Icon,
  active,
  tone = "light",
}: {
  label: string;
  href: string;
  icon: React.ElementType;
  active: boolean;
  tone?: "light" | "dark";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        tone === "dark"
          ? active
            ? "bg-white text-neutral-950 shadow-[0_10px_24px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]"
            : "text-white/54 hover:bg-white/[0.08] hover:text-white"
          : active
            ? "bg-neutral-950 text-white"
            : "text-neutral-500 hover:bg-white hover:text-neutral-950"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}

function MobileNav({ pathname, workspaceId }: { pathname: string; workspaceId: string | null }) {
  const navItems = workspaceId
    ? [
        { label: "首页", href: "/", icon: Home },
        { label: "工作台", href: `/workspaces/${workspaceId}`, icon: LayoutDashboard },
      ]
    : baseNavItems;

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" />}>
        <Menu />
        <span className="sr-only">打开导航</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-paper p-0">
        <SheetHeader className="border-b border-ink/10 px-5 py-4">
          <SheetTitle className="font-display text-lg font-black text-ink">
            ProjectFlow
          </SheetTitle>
          <SheetDescription className="text-xs text-ink/55">
            主动推进型项目 Agent
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <SheetClose
                key={item.href}
                nativeButton={false}
                render={
                  <Link
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-neutral-950 text-white"
                        : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
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
  const workspaceId = useWorkspaceNav();
  const storedUserId = useCurrentUserId();
  const members = useWorkspaceMembers();

  // Check if current page uses three-column layout (project or workspace dashboard)
  const isProjectDashboard =
    (pathname.startsWith("/projects/") && pathname.split("/").length >= 3 && !pathname.includes("/new")) ||
    (pathname.startsWith("/workspaces/") && pathname.split("/").length >= 3 && !pathname.includes("/new"));

  const navItems = workspaceId
    ? [
        { label: "首页", href: "/", icon: Home },
        { label: "工作台", href: `/workspaces/${workspaceId}`, icon: LayoutDashboard },
      ]
    : baseNavItems;

  const currentMember = members.find((m) => m.user_id === storedUserId) ?? members[0];
  const activeUserId = currentMember?.user_id ?? null;
  const isLandingPage = pathname === "/";

  return (
    <div className={cn("bg-paper text-ink", isProjectDashboard ? "h-screen overflow-hidden" : "min-h-screen")}>
      {!isProjectDashboard && (
        <>
          <motion.header
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              "top-0 z-40",
              isLandingPage
                ? "fixed inset-x-0 border-b border-transparent px-4 pt-4"
                : "sticky border-b border-neutral-200 bg-[#f8faf7]/90 backdrop-blur-md",
            )}
          >
            <div
              className={cn(
                "mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8",
                isLandingPage &&
                  "rounded-[28px] border border-white/10 bg-[#07090d]/72 text-white shadow-[0_18px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl",
              )}
            >
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-[8px] shadow-sm",
                      isLandingPage
                        ? "bg-white text-neutral-950 shadow-[0_0_24px_rgba(255,54,77,0.22)]"
                        : "bg-neutral-950 text-white",
                    )}
                  >
                    <Layers3 className="h-4 w-4" aria-hidden />
                  </span>
                  <span className={cn("text-base font-semibold", isLandingPage ? "text-white" : "text-neutral-950")}>
                    ProjectFlow
                  </span>
                </Link>

                <nav className="hidden items-center gap-1 md:flex">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.href}
                      label={item.label}
                      href={item.href}
                      icon={item.icon}
                      active={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
                      tone={isLandingPage ? "dark" : "light"}
                    />
                  ))}
                </nav>
              </div>

              <div className="flex items-center gap-3">
                {members.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "gap-2 text-xs",
                          isLandingPage &&
                            "border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:text-white",
                        )}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {currentMember?.display_name ?? "选择身份"}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end" className="min-w-40">
                      {members.map((member) => (
                        <DropdownMenuItem
                          key={member.user_id}
                          onClick={() => setCurrentUserId(member.user_id)}
                          className={cn(
                            "cursor-pointer text-sm",
                            member.user_id === activeUserId && "font-semibold text-moss",
                          )}
                        >
                          {member.display_name}
                          {member.user_id === activeUserId && " ✓"}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="hidden md:block" />
              </div>

              <div className="md:hidden">
                <MobileNav pathname={pathname} workspaceId={workspaceId} />
              </div>
            </div>
          </motion.header>

        </>
      )}

      <main className={isProjectDashboard ? "h-full" : ""}>
        {children}
      </main>
    </div>
  );
}

"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { CreditCard, Users, Settings, Menu, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const menuItems = [
  {
    title: "Payments",
    href: "/dashboard",
    icon: CreditCard,
  },
  {
    title: "Contacts",
    href: "/dashboard/contacts",
    icon: Users,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

function SidebarContent({ pathname, onCloseSheet }: { pathname: string; onCloseSheet?: () => void }) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
    onCloseSheet?.()
  }

  return (
    <div className="flex h-full flex-col gap-4 border-r bg-background p-4">
      <div className="flex items-center gap-2 px-2 py-4">
        <h1 className="text-xl font-semibold">IOU</h1>
      </div>
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto pt-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-accent-foreground hover:bg-accent"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  )
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile: Sheet menu */}
      <div className="lg:hidden">
        <div className="absolute left-4 top-4 z-10">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px] p-0">
              <SidebarContent pathname={pathname} onCloseSheet={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {/* Desktop: Fixed sidebar */}
      <aside className="hidden w-[250px] lg:block">
        <SidebarContent pathname={pathname} />
      </aside>
    </>
  )
}

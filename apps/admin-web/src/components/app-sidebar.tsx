"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarSyncIcon,
  HelpCircleIcon,
  DashboardBrowsingIcon,
  TvSmartIcon,
  PlaySquareIcon,
  ListSettingIcon,
  PlayListIcon,
  MegaphoneIcon,
  ActivityIcon,
} from "@hugeicons/core-free-icons"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Usuário Telumi",
    email: "conta@telumi.com",
    initials: "TL",
  },
  navSections: [
    {
      label: "Visão Geral",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: DashboardBrowsingIcon,
          isActive: true,
        },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        {
          title: "Mídias",
          url: "/midias",
          icon: PlaySquareIcon,
        },
        {
          title: "Playlists",
          url: "/playlists",
          icon: PlayListIcon,
        },
        {
          title: "Campanhas",
          url: "/campanhas",
          icon: MegaphoneIcon,
        },
      ],
    },
    {
      label: "Operação",
      items: [
        {
          title: "Telas",
          url: "/telas",
          icon: TvSmartIcon,
        },
        {
          title: "Programação",
          url: "/programacao",
          icon: CalendarSyncIcon,
        },
        {
          title: "Monitoramento",
          url: "/monitoramento",
          icon: ActivityIcon,
        },
      ],
    },
    {
      label: "Configurações",
      items: [
        {
          title: "Configurações",
          url: "/configuracoes",
          icon: ListSettingIcon,
        },
        {
          title: "Ajuda",
          url: "/ajuda",
          icon: HelpCircleIcon,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <div className="flex items-center gap-0.5">
                    <span className="h-4 w-1 rounded-full bg-current" />
                    <span className="h-4 w-1 rounded-full bg-current" />
                  </div>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Telumi</span>
                  <span className="truncate text-xs">Painel Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navSections.map((section, index) => (
          <NavMain
            key={section.label}
            label={section.label}
            items={section.items}
            pathname={pathname}
            className={index === data.navSections.length - 1 ? "mt-auto" : undefined}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}

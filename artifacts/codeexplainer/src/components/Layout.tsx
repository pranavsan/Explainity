import React from "react";
import { Link, useLocation } from "wouter";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarFooter } from "@/components/ui/sidebar";
import { FileCode, History, Home, TerminalSquare } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="border-b border-border py-4">
            <div className="flex items-center px-4 gap-2 font-bold text-lg text-primary">
              <TerminalSquare className="w-6 h-6" />
              <span>Explainity</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu className="px-2 py-4">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"}>
                  <Link href="/" className="flex items-center gap-2 px-2" data-testid="link-home">
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/history"}>
                  <Link href="/history" className="flex items-center gap-2 px-2" data-testid="link-history">
                    <History className="w-4 h-4" />
                    <span>History</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t border-border p-4">
            <ThemeToggle />
          </SidebarFooter>
        </Sidebar>
        
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 md:hidden">
            <SidebarTrigger />
            <div className="ml-4 font-bold text-primary flex items-center gap-2">
              <TerminalSquare className="w-5 h-5" />
              <span>Explainity</span>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-8">
            <div className="max-w-5xl mx-auto w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

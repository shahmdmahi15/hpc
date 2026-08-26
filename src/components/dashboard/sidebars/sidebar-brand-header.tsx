"use client";

import * as React from "react";
import Link from "next/link";
import { SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { BrandLogo } from "@/components/brand/logo";

interface SidebarBrandHeaderProps {
  href: string;
}

export function SidebarBrandHeader({ href }: SidebarBrandHeaderProps) {
  const { state } = useSidebar();

  return (
    <SidebarHeader className="p-2 flex items-center justify-center group-data-[collapsible=icon]:p-1.5">
      <Link
        href={href}
        className="flex items-center justify-start group-data-[collapsible=icon]:justify-center w-full"
      >
        <BrandLogo
          size="sm"
          variant={state === "collapsed" ? "icon" : "compact"}
        />
      </Link>
    </SidebarHeader>
  );
}

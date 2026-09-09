"use client";

import type { ComponentProps } from "react";
import { Tabs as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Tabs(props: ComponentProps<typeof Primitive.Root>) { return <Primitive.Root {...props} />; }
export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) { return <Primitive.List className={cn("inline-flex items-center gap-1 rounded-lg bg-muted p-1", className)} {...props} />; }
export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) { return <Primitive.Trigger className={cn("inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-500", className)} {...props} />; }
export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) { return <Primitive.Content className={cn("outline-none focus-visible:ring-2 focus-visible:ring-blue-500", className)} {...props} />; }

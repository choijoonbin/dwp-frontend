"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Construction, ArrowRight, Clock, CheckCircle2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
  features?: string[]
  comingSoon?: string[]
}

export function PlaceholderPage({ title, description, icon: Icon, features = [], comingSoon = [] }: PlaceholderPageProps) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 h-7 px-3">
          <Construction className="h-3.5 w-3.5" />
          Under Development
        </Badge>
      </div>

      {/* Coming Soon Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-8 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            This module is currently under development. Enterprise-grade features will be available in the next release.
          </p>
        </CardContent>
      </Card>

      {/* Features Grid */}
      {(features.length > 0 || comingSoon.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Planned Features
                </CardTitle>
                <CardDescription>Capabilities scheduled for this module</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {comingSoon.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  Roadmap Items
                </CardTitle>
                <CardDescription>Future enhancements being planned</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {comingSoon.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty State Table Placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data Preview</CardTitle>
          <CardDescription>Sample data will appear here once the module is active</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">No data available yet</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

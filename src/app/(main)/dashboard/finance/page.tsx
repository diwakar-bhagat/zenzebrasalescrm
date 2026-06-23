"use client";

import { format } from "date-fns";
import { CircleDollarSign, Clock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4 p-4 pt-4 md:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold text-3xl leading-none tracking-tight">
          Financial Overview
        </h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDollarSign className="size-5 text-muted-foreground" />
            Finance module coming soon
          </CardTitle>
          <CardDescription>
            This page is intentionally detached from uploaded sales sheets until
            finance-specific source data is defined.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            "Total Net Worth",
            "Available Cash",
            "Spending Pool",
          ].map((label) => (
            <div className="rounded-lg border bg-muted/20 p-4" key={label}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-sm">{label}</p>
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-6 text-muted-foreground text-sm">
                Waiting for finance data source
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { ZenZebraLogo } from "@/components/brand/ZenZebraLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <ZenZebraLogo size="lg" showTagline />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create account</CardTitle>
            <CardDescription>
              Account creation is managed by your administrator. Contact management to request access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
              <div className="space-y-1.5">
                <Label htmlFor="employee-id">Employee ID</Label>
                <Input id="employee-id" placeholder="EMP001" disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="full-name">Full name</Label>
                <Input id="full-name" placeholder="Your name" disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="username" disabled />
              </div>
              <Button type="submit" className="w-full" disabled>
                Request access
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { AlertTriangleIcon, MailIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AccessDenied() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangleIcon className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-xl text-slate-900">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-slate-600">
            You don't have permission to access this application. Only authorized ticket holders can use this system.
          </p>
          <p className="text-sm text-slate-500">
            If you believe this is an error, please contact the administrator to verify your email address is registered as a ticket holder.
          </p>
          <div className="pt-4 space-y-3">
            <Button 
              onClick={() => window.location.href = "/api/logout"}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
            <Button 
              onClick={() => window.location.href = "/api/login"}
              className="w-full"
            >
              Try Different Account
            </Button>
          </div>
          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <MailIcon className="w-3 h-3" />
              Contact support if you need assistance
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
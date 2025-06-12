import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TicketIcon, UsersIcon, DollarSignIcon, CalendarIcon } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <TicketIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="ml-3 text-xl font-bold text-slate-900">TicketManager</h1>
            </div>
            <Button onClick={() => window.location.href = "/api/login"}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl">
            Manage Your Season Tickets
          </h2>
          <p className="mt-6 text-xl text-slate-600 max-w-3xl mx-auto">
            Track ownership, manage finances, coordinate attendance, and handle seat transfers 
            across multiple teams and seasons with ease.
          </p>
          <div className="mt-10">
            <Button 
              size="lg" 
              onClick={() => window.location.href = "/api/login"}
              className="px-8 py-3 text-lg"
            >
              Get Started
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Game Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-center">
                Schedule games, track attendance, and manage pricing per seat for each game.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <DollarSignIcon className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>Financial Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-center">
                Monitor payments, payouts, and profitability with detailed financial summaries.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <TicketIcon className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Seat Ownership</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-center">
                Assign seat ownership per season and transfer seats between ticket holders.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>Ticket Holders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-center">
                Manage ticket holder information and track their involvement across seasons.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-20 bg-white rounded-2xl shadow-sm border border-slate-200 p-12">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-900">
              Ready to streamline your season ticket management?
            </h3>
            <p className="mt-4 text-lg text-slate-600">
              Sign in to get started with your dashboard and begin managing your teams and seasons.
            </p>
            <div className="mt-8">
              <Button 
                size="lg" 
                onClick={() => window.location.href = "/api/login"}
                className="px-8 py-3 text-lg"
              >
                Sign In Now
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

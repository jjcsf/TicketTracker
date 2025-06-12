import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import type { User } from "@shared/schema";
import { 
  TicketIcon, 
  BarChart3Icon, 
  CalendarIcon, 
  RockingChair, 
  DollarSignIcon, 
  UsersIcon, 
  FileTextIcon,
  LogOutIcon,
  Calculator
} from "lucide-react";

const navigation = [
  { name: 'Dashboard', icon: BarChart3Icon, href: '/' },
  { name: 'Games', icon: CalendarIcon, href: '/games' },
  { name: 'Seats & Ownership', icon: RockingChair, href: '/seats' },
  { name: 'Finances', icon: DollarSignIcon, href: '/finances' },
  { name: 'Ticket Holders', icon: UsersIcon, href: '/ticket-holders' },
  { name: 'Seat Predictions', icon: Calculator, href: '/seat-predictions' },
  { name: 'Reports', icon: FileTextIcon, href: '/reports' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getDisplayName = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    if (lastName) return lastName;
    return "User";
  };

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
      <div className="flex flex-col flex-grow bg-white shadow-sm border-r border-slate-200">
        {/* Logo Section */}
        <div className="flex items-center flex-shrink-0 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <TicketIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="ml-3 text-lg font-semibold text-slate-900">TicketManager</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`mr-3 w-5 h-5 ${
                  isActive ? 'text-primary' : 'text-slate-400'
                }`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.profileImageUrl || ""} alt={getDisplayName(user?.firstName || undefined, user?.lastName || undefined)} />
                <AvatarFallback className="text-sm">
                  {getInitials(user?.firstName || undefined, user?.lastName || undefined)}
                </AvatarFallback>
              </Avatar>
              <div className="ml-3 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {getDisplayName(user?.firstName || undefined, user?.lastName || undefined)}
                </p>
                <p className="text-xs text-slate-500">Season Manager</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = "/api/logout"}
              className="ml-2"
            >
              <LogOutIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

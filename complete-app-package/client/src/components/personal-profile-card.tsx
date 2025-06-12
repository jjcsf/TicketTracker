import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserIcon, MailIcon, RockingChair, TrophyIcon, EditIcon } from "lucide-react";
import { useTicketHolderProfile } from "@/hooks/useTicketHolderProfile";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { SeatOwnership } from "@shared/schema";

interface PersonalProfileCardProps {
  onEditProfile?: () => void;
}

export default function PersonalProfileCard({ onEditProfile }: PersonalProfileCardProps) {
  const { user } = useAuth();
  const { ticketHolder, isMatched } = useTicketHolderProfile();

  const { data: seatOwnerships } = useQuery<SeatOwnership[]>({
    queryKey: ["/api/seat-ownership"],
  });

  // Calculate personal seat ownership stats
  const personalStats = ticketHolder ? (() => {
    const ownerships = seatOwnerships?.filter(so => so.ticketHolderId === ticketHolder.id) || [];
    const uniqueSeasons = Array.from(new Set(ownerships.map(so => so.seasonId)));
    return {
      totalSeats: ownerships.length,
      seasons: uniqueSeasons.length
    };
  })() : { totalSeats: 0, seasons: 0 };

  if (!isMatched) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <UserIcon className="w-5 h-5" />
            Profile Not Linked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-yellow-700">
              Your account ({user?.email}) is not linked to a ticket holder profile.
            </p>
            <p className="text-xs text-yellow-600">
              Contact an administrator to link your account to your ticket holder record.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-800">
            <UserIcon className="w-5 h-5" />
            Your Profile
          </div>
          {onEditProfile && (
            <Button variant="outline" size="sm" onClick={onEditProfile}>
              <EditIcon className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-blue-900">{ticketHolder?.name}</h3>
            <div className="flex items-center gap-1 text-sm text-blue-700 mt-1">
              <MailIcon className="w-3 h-3" />
              {ticketHolder?.email}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
              <RockingChair className="w-3 h-3 mr-1" />
              {personalStats.totalSeats} seats
            </Badge>
            {personalStats.seasons > 0 && (
              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                <TrophyIcon className="w-3 h-3 mr-1" />
                {personalStats.seasons} seasons
              </Badge>
            )}
          </div>

          {ticketHolder?.notes && (
            <div className="p-3 bg-white rounded-md border border-blue-200">
              <p className="text-xs text-slate-600 font-medium mb-1">Notes</p>
              <p className="text-sm text-slate-700">{ticketHolder?.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
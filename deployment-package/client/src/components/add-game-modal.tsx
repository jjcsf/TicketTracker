import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Season, Team } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonId?: number | null;
}

const gameSchema = z.object({
  seasonId: z.string().min(1, "Please select a season"),
  date: z.string().min(1, "Please select a date"),
  time: z.string().optional(),
  opponent: z.string().min(1, "Please enter opponent name"),
  seasonType: z.string().min(1, "Please select season type"),
  notes: z.string().optional(),
});

type GameFormData = z.infer<typeof gameSchema>;

export default function AddGameModal({ isOpen, onClose, seasonId }: AddGameModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<GameFormData>({
    resolver: zodResolver(gameSchema),
    defaultValues: {
      seasonId: seasonId?.toString() || "",
      date: "",
      time: "",
      opponent: "",
      seasonType: "Regular Season",
      notes: "",
    },
  });

  // Get all seasons and teams for the selector
  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    enabled: isOpen,
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: isOpen,
  });

  // Get selected season details
  const selectedSeasonId = parseInt(form.watch("seasonId")) || seasonId;
  const selectedSeason = seasons?.find(s => s.id === selectedSeasonId);
  const selectedTeam = teams?.find(t => t.id === selectedSeason?.teamId);

  const gameMutation = useMutation({
    mutationFn: async (data: GameFormData) => {
      const selectedSeasonId = parseInt(data.seasonId);
      if (!selectedSeasonId) throw new Error("No season selected");
      
      const gameData = {
        seasonId: selectedSeasonId,
        date: data.date,
        time: data.time || null,
        opponent: data.opponent,
        seasonType: data.seasonType,
        notes: data.notes || null,
      };
      
      return apiRequest("POST", "/api/games", gameData);
    },
    onSuccess: () => {
      const teamName = selectedTeam?.name || "Team";
      const seasonYear = selectedSeason?.year || "Season";
      toast({
        title: "Game Added Successfully",
        description: `Game has been added to ${teamName} ${seasonYear} season.`,
      });
      form.reset({
        seasonId: seasonId?.toString() || "",
        date: "",
        time: "",
        opponent: "",
        seasonType: "Regular Season",
        notes: "",
      });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add game. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: GameFormData) => {
    gameMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add New Game
            {selectedTeam && selectedSeason && (
              <div className="text-sm font-normal text-slate-600 mt-1">
                {selectedTeam.name} • {selectedSeason.year} Season
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Season Selector */}
            <FormField
              control={form.control}
              name="seasonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a season" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {seasons
                        ?.sort((a, b) => {
                          const teamA = teams?.find(t => t.id === a.teamId)?.name || '';
                          const teamB = teams?.find(t => t.id === b.teamId)?.name || '';
                          return teamA.localeCompare(teamB) || b.year - a.year;
                        })
                        ?.map((season) => {
                          const team = teams?.find(t => t.id === season.teamId);
                          return (
                            <SelectItem key={season.id} value={season.id.toString()}>
                              {team?.name} - {season.year}
                            </SelectItem>
                          );
                        })
                      }
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Season Assignment Display */}
            {selectedTeam && selectedSeason && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm font-medium text-blue-900">
                  Adding game to: {selectedTeam.name} {selectedSeason.year} Season
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  This game will be automatically assigned to the selected season
                </div>
              </div>
            )}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Game Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Game Time (Optional)</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="opponent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opponent</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Green Bay Packers" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="seasonType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select season type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pre Season">Pre Season</SelectItem>
                      <SelectItem value="Regular Season">Regular Season</SelectItem>
                      <SelectItem value="Post Season">Post Season</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes about the game..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={gameMutation.isPending}>
                {gameMutation.isPending ? "Adding..." : "Add Game"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatTime } from "@/lib/timeUtils";
import { DownloadIcon, CalendarIcon, HomeIcon } from "lucide-react";
import type { Team, Season } from "@shared/schema";

interface ImportScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const importSchema = z.object({
  teamId: z.string().min(1, "Please select a team"),
  seasonYear: z.number().min(2020, "Year must be 2020 or later").max(2030, "Year must be 2030 or earlier"),
  includePreseason: z.boolean().default(false),
  includePostseason: z.boolean().default(false),
  homeGamesOnly: z.boolean().default(true),
});

type ImportFormData = z.infer<typeof importSchema>;

// NBA team mapping for ESPN API with variations
const NBA_TEAMS = {
  "Atlanta Hawks": "atl",
  "Hawks": "atl",
  "Boston Celtics": "bos",
  "Celtics": "bos",
  "Brooklyn Nets": "bkn",
  "Nets": "bkn",
  "Charlotte Hornets": "cha",
  "Hornets": "cha",
  "Chicago Bulls": "chi",
  "Bulls": "chi",
  "Cleveland Cavaliers": "cle",
  "Cavaliers": "cle",
  "Cavs": "cle",
  "Dallas Mavericks": "dal",
  "Mavericks": "dal",
  "Mavs": "dal",
  "Denver Nuggets": "den",
  "Nuggets": "den",
  "Detroit Pistons": "det",
  "Pistons": "det",
  "Golden State Warriors": "gs",
  "Warriors": "gs",
  "Houston Rockets": "hou",
  "Rockets": "hou",
  "Indiana Pacers": "ind",
  "Pacers": "ind",
  "Los Angeles Clippers": "lac",
  "Clippers": "lac",
  "Los Angeles Lakers": "lal",
  "Lakers": "lal",
  "Memphis Grizzlies": "mem",
  "Grizzlies": "mem",
  "Miami Heat": "mia",
  "Heat": "mia",
  "Milwaukee Bucks": "mil",
  "Bucks": "mil",
  "Minnesota Timberwolves": "min",
  "Timberwolves": "min",
  "Wolves": "min",
  "New Orleans Pelicans": "no",
  "Pelicans": "no",
  "New York Knicks": "ny",
  "Knicks": "ny",
  "Oklahoma City Thunder": "okc",
  "Thunder": "okc",
  "Orlando Magic": "orl",
  "Magic": "orl",
  "Philadelphia 76ers": "phi",
  "76ers": "phi",
  "Sixers": "phi",
  "Phoenix Suns": "phx",
  "Suns": "phx",
  "Portland Trail Blazers": "por",
  "Trail Blazers": "por",
  "Blazers": "por",
  "Sacramento Kings": "sac",
  "Kings": "sac",
  "San Antonio Spurs": "sa",
  "Spurs": "sa",
  "Toronto Raptors": "tor",
  "Raptors": "tor",
  "Utah Jazz": "utah",
  "Jazz": "utah",
  "Washington Wizards": "wsh",
  "Wizards": "wsh"
};

// NFL team mapping for ESPN API with variations
const NFL_TEAMS = {
  "Arizona Cardinals": "ari",
  "Cardinals": "ari",
  "Atlanta Falcons": "atl",
  "Falcons": "atl",
  "Baltimore Ravens": "bal",
  "Ravens": "bal",
  "Buffalo Bills": "buf",
  "Bills": "buf",
  "Carolina Panthers": "car",
  "Panthers": "car",
  "Chicago Bears": "chi",
  "Bears": "chi",
  "Cincinnati Bengals": "cin",
  "Bengals": "cin",
  "Cleveland Browns": "cle",
  "Browns": "cle",
  "Dallas Cowboys": "dal",
  "Cowboys": "dal",
  "Denver Broncos": "den",
  "Broncos": "den",
  "Detroit Lions": "det",
  "Lions": "det",
  "Green Bay Packers": "gb",
  "Packers": "gb",
  "Houston Texans": "hou",
  "Texans": "hou",
  "Indianapolis Colts": "ind",
  "Colts": "ind",
  "Jacksonville Jaguars": "jax",
  "Jaguars": "jax",
  "Kansas City Chiefs": "kc",
  "Chiefs": "kc",
  "Las Vegas Raiders": "lv",
  "Raiders": "lv",
  "Los Angeles Chargers": "lac",
  "Chargers": "lac",
  "Los Angeles Rams": "lar",
  "Rams": "lar",
  "Miami Dolphins": "mia",
  "Dolphins": "mia",
  "Minnesota Vikings": "min",
  "Vikings": "min",
  "New England Patriots": "ne",
  "Patriots": "ne",
  "New Orleans Saints": "no",
  "Saints": "no",
  "New York Giants": "nyg",
  "Giants": "nyg",
  "New York Jets": "nyj",
  "Jets": "nyj",
  "Philadelphia Eagles": "phi",
  "Eagles": "phi",
  "Pittsburgh Steelers": "pit",
  "Steelers": "pit",
  "San Francisco 49ers": "sf",
  "49ers": "sf",
  "Niners": "sf",
  "Seattle Seahawks": "sea",
  "Seahawks": "sea",
  "Tampa Bay Buccaneers": "tb",
  "Buccaneers": "tb",
  "Bucs": "tb",
  "Tennessee Titans": "ten",
  "Titans": "ten",
  "Washington Commanders": "wsh",
  "Commanders": "wsh"
};

export default function ImportScheduleModal({ isOpen, onClose }: ImportScheduleModalProps) {
  const [previewGames, setPreviewGames] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();



  const form = useForm<ImportFormData>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      teamId: "",
      seasonYear: new Date().getFullYear(),
      includePreseason: false,
      includePostseason: false,
      homeGamesOnly: true,
    },
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const previewMutation = useMutation({
    mutationFn: async (data: ImportFormData): Promise<any[]> => {
      const team = teams?.find(t => t.id.toString() === data.teamId);
      
      if (!team) {
        throw new Error("Team not found");
      }

      const response = await apiRequest("POST", "/api/schedule/preview", {
        teamName: team.name,
        year: data.seasonYear,
        includePreseason: data.includePreseason,
        includePostseason: data.includePostseason,
        homeGamesOnly: data.homeGamesOnly,
      });
      
      const data_result = await response.json();
      return Array.isArray(data_result) ? data_result : [];
    },
    onSuccess: (games: any[]) => {
      setPreviewGames(games);
      setShowPreview(true);
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
        description: "Failed to fetch schedule preview. Please try again.",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: ImportFormData) => {
      // First, ensure the season exists or create it
      const team = teams?.find(t => t.id.toString() === data.teamId);
      if (!team) {
        throw new Error("Team not found");
      }

      let existingSeason = seasons?.find(s => s.teamId === team.id && s.year === data.seasonYear);
      
      if (!existingSeason) {
        // Create the season
        const response = await apiRequest("POST", "/api/seasons", {
          teamId: team.id,
          year: data.seasonYear,
        });
        existingSeason = await response.json();
      }

      if (!existingSeason) {
        throw new Error("Failed to create or find season");
      }

      return apiRequest("POST", "/api/schedule/import", {
        seasonId: existingSeason.id,
        games: previewGames,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Successfully imported ${previewGames.length} games.`,
      });
      onClose();
      setShowPreview(false);
      setPreviewGames([]);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
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
        description: "Failed to import schedule. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePreview = (data: ImportFormData) => {
    previewMutation.mutate(data);
  };

  const handleImport = () => {
    const formData = form.getValues();
    importMutation.mutate(formData);
  };

  const getTeamEspnCode = (teamName: string) => {
    const nflCode = NFL_TEAMS[teamName as keyof typeof NFL_TEAMS];
    const nbaCode = NBA_TEAMS[teamName as keyof typeof NBA_TEAMS];
    return nflCode || nbaCode || null;
  };

  const getTeamSport = (teamName: string) => {
    if (NFL_TEAMS[teamName as keyof typeof NFL_TEAMS]) return 'NFL';
    if (NBA_TEAMS[teamName as keyof typeof NBA_TEAMS]) return 'NBA';
    return null;
  };

  const selectedTeam = teams?.find(t => t.id.toString() === form.watch("teamId"));
  const teamSport = selectedTeam ? getTeamSport(selectedTeam.name) : null;
  const isSupportedTeam = selectedTeam ? getTeamEspnCode(selectedTeam.name) !== null : false;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DownloadIcon className="h-5 w-5" />
            Import Schedule
          </DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePreview)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="teamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teams?.map((team) => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.name}
                              {getTeamSport(team.name) && (
                                <span className={`ml-2 text-xs ${getTeamSport(team.name) === 'NFL' ? 'text-green-600' : 'text-blue-600'}`}>
                                  ({getTeamSport(team.name)})
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seasonYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="2025"
                          min="2020"
                          max="2030"
                          {...field}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {!isSupportedTeam && selectedTeam && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>{selectedTeam.name}</strong> is not a supported team. Schedule import is currently available for NFL and NBA teams only.
                  </p>
                </div>
              )}

              {isSupportedTeam && (
                <>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="homeGamesOnly"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="flex items-center gap-2">
                              <HomeIcon className="h-4 w-4" />
                              Import home games only
                            </FormLabel>
                            <p className="text-sm text-slate-500">
                              Only import games played at the team's home stadium
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="includePreseason"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Include preseason games</FormLabel>
                            <p className="text-sm text-slate-500">
                              Import preseason exhibition games
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="includePostseason"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Include postseason games</FormLabel>
                            <p className="text-sm text-slate-500">
                              Import playoff and championship games
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={previewMutation.isPending || !isSupportedTeam}
                    >
                      {previewMutation.isPending ? "Loading..." : "Preview Schedule"}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Schedule Preview</h3>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  setPreviewGames([]);
                }}
              >
                Back to Settings
              </Button>
            </div>

            {previewGames.length > 0 ? (
              <>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Found <strong>{previewGames.length} games</strong> matching your criteria. Review and confirm import.
                  </p>
                </div>

                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Time</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Opponent</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewGames.map((game, index) => (
                        <tr key={index} className="border-b border-slate-100">
                          <td className="py-3 px-4">
                            {new Date(game.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            {game.time ? formatTime(game.time) : 'TBD'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {game.opponentLogo && (
                                <img 
                                  src={game.opponentLogo} 
                                  alt={`${game.opponent} logo`}
                                  className="w-6 h-6 object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              )}
                              <span>{game.opponent}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              game.seasonType === 'Regular Season' ? 'bg-blue-100 text-blue-800' :
                              game.seasonType === 'Preseason' ? 'bg-green-100 text-green-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {game.seasonType}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              game.isHome ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {game.isHome ? 'Home' : 'Away'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? "Importing..." : `Import ${previewGames.length} Games`}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">No games found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
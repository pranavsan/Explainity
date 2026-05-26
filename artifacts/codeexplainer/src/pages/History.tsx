import React, { useState } from "react";
import { Link } from "wouter";
import { useListAnalyses, useDeleteAnalysis, getListAnalysesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2, ExternalLink, Filter, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function History() {
  const queryClient = useQueryClient();
  const { data: analyses, isLoading } = useListAnalyses({
    query: {
      queryKey: getListAnalysesQueryKey()
    }
  });

  const deleteAnalysis = useDeleteAnalysis();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const handleDelete = (id: number) => {
    deleteAnalysis.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Analysis deleted");
          queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        },
        onError: () => {
          toast.error("Failed to delete analysis");
        }
      }
    );
  };

  const filteredAnalyses = analyses?.filter(analysis => {
    const matchesSearch = analysis.githubUrl.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === "all" || analysis.level === levelFilter;
    const matchesStatus = statusFilter === "all" || analysis.status === statusFilter;
    return matchesSearch && matchesLevel && matchesStatus;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analysis History</h1>
          <p className="text-muted-foreground mt-1">Review and manage your past repository analyses.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-muted/30 p-4 rounded-lg border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search repositories..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-history"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full md:w-[180px]" data-testid="select-filter-level">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]" data-testid="select-filter-status">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="processing">Processing / Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse h-24 bg-muted/50" />
          ))}
        </div>
      ) : filteredAnalyses && filteredAnalyses.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredAnalyses.map(analysis => (
            <Card key={analysis.id} className="hover:border-primary/30 transition-all overflow-hidden" data-testid={`card-history-item-${analysis.id}`}>
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 sm:p-6 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-mono font-semibold truncate" title={analysis.githubUrl}>
                        {analysis.githubUrl.replace("https://github.com/", "")}
                      </h3>
                      <Badge variant={analysis.status === "completed" ? "default" : analysis.status === "failed" ? "destructive" : "secondary"}>
                        {analysis.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{format(new Date(analysis.createdAt), "MMM d, yyyy HH:mm")}</span>
                      <span className="capitalize border border-border px-2 py-0.5 rounded text-xs">{analysis.level}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <Button variant="outline" asChild size="sm">
                      <Link href={`/analysis/${analysis.id}`} data-testid={`link-view-analysis-${analysis.id}`}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-analysis-${analysis.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this analysis for {analysis.githubUrl.split('/').pop()}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(analysis.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed rounded-lg">
          <p className="text-muted-foreground">No analyses found matching your filters.</p>
          {(search || levelFilter !== "all" || statusFilter !== "all") && (
            <Button variant="link" onClick={() => { setSearch(""); setLevelFilter("all"); setStatusFilter("all"); }} className="mt-2">
              Clear filters
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateAnalysis, useGetAnalysisStats, getListAnalysesQueryKey, getGetAnalysisStatsQueryKey, AnalysisInputLevel } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Code, LayoutDashboard } from "lucide-react";
import { SiGithub } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

const formSchema = z.object({
  githubUrl: z.string().url().includes("github.com", { message: "Must be a valid GitHub URL" }),
  level: z.nativeEnum(AnalysisInputLevel),
});

export function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createAnalysis = useCreateAnalysis();
  
  const { data: stats, isLoading: statsLoading } = useGetAnalysisStats({
    query: {
      queryKey: getGetAnalysisStatsQueryKey()
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      githubUrl: "",
      level: AnalysisInputLevel.intermediate,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createAnalysis.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast.success("Analysis started!");
          queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAnalysisStatsQueryKey() });
          setLocation(`/analysis/${data.id}`);
        },
        onError: (error) => {
          toast.error(error.error?.error || "Failed to start analysis");
        },
      }
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Zap className="w-8 h-8 text-primary" /> 
          Analyse a Codebase
        </h1>
        <p className="text-muted-foreground text-lg">
          Paste a GitHub repository URL to get a comprehensive, tutorial-style explanation of its architecture and functionality.
        </p>
      </div>

      <Card className="border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle>New Analysis</CardTitle>
          <CardDescription>Enter details to start the AI analysis engine.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="githubUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub Repository URL</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <SiGithub className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="https://github.com/owner/repo" className="pl-9" data-testid="input-github-url" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Explanation Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-level">
                          <SelectValue placeholder="Select detail level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={AnalysisInputLevel.beginner}>Beginner (Explains basics)</SelectItem>
                        <SelectItem value={AnalysisInputLevel.intermediate}>Intermediate (Standard)</SelectItem>
                        <SelectItem value={AnalysisInputLevel.advanced}>Advanced (In-depth)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={createAnalysis.isPending} className="w-full" data-testid="button-submit-analysis">
                {createAnalysis.isPending ? "Starting Engine..." : "Analyse Repository"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-muted-foreground" />
          Recent Analyses
        </h2>
        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted/50 rounded-t-lg" />
              </Card>
            ))}
          </div>
        ) : stats?.recentAnalyses && stats.recentAnalyses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.recentAnalyses.map(analysis => (
              <Card key={analysis.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setLocation(`/analysis/${analysis.id}`)} data-testid={`card-recent-analysis-${analysis.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base font-mono truncate mr-2" title={analysis.githubUrl}>
                      {analysis.githubUrl.replace("https://github.com/", "")}
                    </CardTitle>
                    <Badge variant={analysis.status === 'completed' ? 'default' : analysis.status === 'failed' ? 'destructive' : 'secondary'}>
                      {analysis.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-2">
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">{analysis.level}</Badge>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No recent analyses. Start one above!</p>
        )}
      </div>
    </motion.div>
  );
}

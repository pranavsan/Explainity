import React, { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { useGetAnalysis, getGetAnalysisQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Terminal, FileCode, CheckCircle2, GitCommit, PlaySquare, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";

export function AnalysisDetail() {
  const [, params] = useRoute("/analysis/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const queryClient = useQueryClient();
  
  const { data: analysis, isLoading, error } = useGetAnalysis(id, {
    query: {
      enabled: !!id,
      queryKey: getGetAnalysisQueryKey(id),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "pending" || status === "processing" ? 2000 : false;
      }
    }
  });

  const [streamData, setStreamData] = useState<Record<string, string>>({});
  const streamTriggered = useRef(false);

  useEffect(() => {
    if (!analysis || streamTriggered.current) return;

    if (analysis.status === "pending" || analysis.status === "processing") {
      streamTriggered.current = true;
      
      const triggerStream = async () => {
        try {
          const res = await fetch(`/api/analyses/${id}/stream`, {
            method: "POST",
          });
          
          if (!res.body) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(Boolean);
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
                  break;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.done) {
                    queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
                  } else if (parsed.section && parsed.content) {
                    setStreamData(prev => ({
                      ...prev,
                      [parsed.section]: (prev[parsed.section] || "") + parsed.content
                    }));
                  }
                } catch (e) {
                  console.error("Failed to parse SSE data", e);
                }
              }
            }
          }
        } catch (e) {
          console.error("Stream error", e);
        }
      };

      triggerStream();
    }
  }, [analysis, id, queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-1/3 bg-muted rounded"></div>
        <div className="h-4 w-1/4 bg-muted rounded"></div>
        <Card>
          <CardContent className="h-64"></CardContent>
        </Card>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-destructive" />
        <h2 className="text-2xl font-bold">Analysis Not Found</h2>
        <p className="text-muted-foreground">The analysis could not be loaded or doesn't exist.</p>
      </div>
    );
  }

  const isComplete = analysis.status === "completed";
  const isFailed = analysis.status === "failed";
  const isProcessing = analysis.status === "processing" || analysis.status === "pending";

  const getSectionContent = (section: string) => {
    return streamData[section] || (analysis as any)[section] || "";
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono text-primary truncate max-w-xl">
              {analysis.githubUrl.replace("https://github.com/", "")}
            </h1>
            <Badge variant={isComplete ? "default" : isFailed ? "destructive" : "secondary"}>
              {analysis.status}
            </Badge>
            <Badge variant="outline">{analysis.level}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Analysis ID: {analysis.id}</p>
        </div>
      </div>

      {isProcessing && (
        <Card className="border-primary/50 bg-primary/5 animate-pulse">
          <CardContent className="py-6 flex flex-col items-center justify-center space-y-4">
            <Terminal className="w-10 h-10 text-primary animate-bounce" />
            <h3 className="text-xl font-medium">Analyzing Codebase</h3>
            <div className="w-full max-w-md">
              <Progress value={undefined} className="h-2" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Our AI engine is currently walking through the repository.<br/>
              Results will stream in below in real-time.
            </p>
          </CardContent>
        </Card>
      )}

      {isFailed && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-6 flex flex-col items-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <h3 className="text-xl font-medium text-destructive">Analysis Failed</h3>
            <p className="text-sm">{analysis.errorMessage || "An unknown error occurred during analysis."}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto md:h-12 w-full gap-2 bg-muted/50 p-1">
          <TabsTrigger value="summary" className="data-[state=active]:bg-background"><FileCode className="w-4 h-4 mr-2" /> Summary</TabsTrigger>
          <TabsTrigger value="architecture" className="data-[state=active]:bg-background"><LayoutDashboard className="w-4 h-4 mr-2" /> Architecture</TabsTrigger>
          <TabsTrigger value="functions" className="data-[state=active]:bg-background"><Terminal className="w-4 h-4 mr-2" /> Key Functions</TabsTrigger>
          <TabsTrigger value="dataflow" className="data-[state=active]:bg-background"><GitCommit className="w-4 h-4 mr-2" /> Data Flow</TabsTrigger>
          <TabsTrigger value="walkthrough" className="data-[state=active]:bg-background"><PlaySquare className="w-4 h-4 mr-2" /> Walkthrough</TabsTrigger>
        </TabsList>
        
        <div className="mt-6 bg-card border border-border rounded-lg shadow-sm">
          <TabsContent value="summary" className="p-6 m-0 outline-none">
            {getSectionContent("summary") ? (
              <MarkdownRenderer content={getSectionContent("summary")} />
            ) : (
              <div className="text-muted-foreground italic text-center py-10">Waiting for content...</div>
            )}
          </TabsContent>
          <TabsContent value="architecture" className="p-6 m-0 outline-none">
            {getSectionContent("architecture") ? (
              <MarkdownRenderer content={getSectionContent("architecture")} />
            ) : (
              <div className="text-muted-foreground italic text-center py-10">Waiting for content...</div>
            )}
          </TabsContent>
          <TabsContent value="functions" className="p-6 m-0 outline-none">
            {getSectionContent("keyFunctions") ? (
              <MarkdownRenderer content={getSectionContent("keyFunctions")} />
            ) : (
              <div className="text-muted-foreground italic text-center py-10">Waiting for content...</div>
            )}
          </TabsContent>
          <TabsContent value="dataflow" className="p-6 m-0 outline-none">
            {getSectionContent("dataFlow") ? (
              <MarkdownRenderer content={getSectionContent("dataFlow")} />
            ) : (
              <div className="text-muted-foreground italic text-center py-10">Waiting for content...</div>
            )}
          </TabsContent>
          <TabsContent value="walkthrough" className="p-6 m-0 outline-none">
            {getSectionContent("walkthrough") ? (
              <MarkdownRenderer content={getSectionContent("walkthrough")} />
            ) : (
              <div className="text-muted-foreground italic text-center py-10">Waiting for content...</div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </motion.div>
  );
}


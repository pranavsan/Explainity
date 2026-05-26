import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:border-border prose-pre:border prose-pre:rounded-md prose-code:text-primary">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}

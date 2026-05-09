import { Fragment, type CSSProperties, type ReactNode } from "react";

interface MarkdownContentProps {
  content: string;
  className?: string;
  style?: CSSProperties;
  highlightFinalQuestion?: boolean;
  questionAccent?: string;
  questionBackground?: string;
  questionBorder?: string;
  compact?: boolean;
}

const inlinePattern = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|`[^`]+`|\*[^*\n]+?\*)/g;

function renderInlineMarkdown(value: string): ReactNode[] {
  return cleanDisplayText(value).split(inlinePattern).map((part, index) => {
    if (!part) return null;

    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      const boldContent = cleanDisplayText(part.slice(2, -2)).trim();
      if (!shouldRenderStrong(boldContent)) {
        return <Fragment key={index}>{boldContent}</Fragment>;
      }

      return (
        <strong key={index} style={{ fontWeight: 750 }}>
          {boldContent}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{cleanDisplayText(part.slice(1, -1))}</em>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          style={{
            background: "var(--mb-s3)",
            border: "1px solid var(--mb-border-subtle)",
            borderRadius: 5,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.92em",
            padding: "0.05rem 0.28rem",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={index}>{cleanDisplayText(part)}</Fragment>;
  });
}

function getListMatch(line: string) {
  return line.match(/^(\s*)([-•]|\d+[.)])\s+(.+)$/);
}

function getHeadingMatch(block: string) {
  return block.trim().match(/^#{1,6}\s+(.+)$/);
}

function cleanDisplayText(value: string) {
  return value
    .replace(/(^|\s)#(?=\d+\b)/g, "$1")
    .replace(/\*\*(#(?=\d+\b))/g, "**")
    .replace(/(^|\s)#{1,6}\s+(?=\S)/g, "$1");
}

function shouldRenderStrong(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  if (!value) return false;
  if (value.length > 80 || words.length > 9) return false;
  if (value.includes("\n")) return false;
  if (/^(étape|tâche)\s+\d/i.test(value) && value.length > 34) return false;
  return true;
}

function normalizeMarkdownLayout(value: string) {
  return value
    .replace(/\s+(#{2,6}\s+)/g, "\n\n$1")
    .replace(/\s+(-\s+)/g, "\n$1")
    .replace(/\s+(\d+[.)]\s+)/g, "\n$1")
    .replace(/\s+(\*\*(?:Priorité|Décision|Blocage|Prochaine action|Question utile|À valider)[^*]{0,90}\*\*)/gi, "\n\n$1")
    .replace(/\s+(Étape\s+\d+\s*[:：])/gi, "\n\n$1")
    .replace(/\s+(Tâche\s+\d+(?:\.\d+)?\s*[:：])/gi, "\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLikelyFinalQuestion(block: string) {
  const cleaned = cleanDisplayText(block).trim();
  if (/^(prochaine tâche|prochaine action|tâche attendue|action attendue|à toi|validation attendue)\b/i.test(cleaned)) return true;
  if (!cleaned.endsWith("?")) return false;

  return (
    /\?$/.test(cleaned) ||
    /\b(souhaites-tu|souhaitez-vous|veux-tu|voulez-vous|as-tu|avez-vous|est-ce que|peux-tu|pouvez-vous)\b/i.test(cleaned)
  );
}

function renderBlock(
  block: string,
  index: number,
  options?: {
    isFinalQuestion?: boolean;
    questionAccent?: string;
    questionBackground?: string;
    questionBorder?: string;
    compact?: boolean;
  },
) {
  const lines = block.split("\n");
  const listMatches = lines.map(getListMatch);
  const isList = listMatches.every(Boolean);
  const headingMatch = lines.length === 1 ? getHeadingMatch(block) : null;

  if (options?.isFinalQuestion) {
    const calloutLabel = /^(prochaine tâche|prochaine action|tâche attendue|action attendue|à toi|validation attendue)\b/i.test(cleanDisplayText(block).trim())
      ? "Tâche attendue"
      : "Question à traiter";

    return (
      <div
        key={index}
        style={{
          marginTop: "0.2rem",
          padding: options.compact ? "0.62rem 0.72rem" : "0.85rem 0.95rem",
          borderRadius: options.compact ? 12 : 14,
          background: options.questionBackground ?? "var(--mb-s1)",
          border: `1px solid ${options.questionBorder ?? "var(--mb-border)"}`,
        }}
      >
        <p
          style={{
            margin: "0 0 0.35rem",
            color: options.questionAccent ?? "currentColor",
            fontSize: options.compact ? "0.6rem" : "0.68rem",
            fontWeight: 750,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {calloutLabel}
        </p>
        <p style={{ margin: 0, fontWeight: 650 }}>
          {renderInlineMarkdown(block)}
        </p>
      </div>
    );
  }

  if (headingMatch?.[1]) {
    return (
      <p
        key={index}
        style={{
          margin: "0.15rem 0 0",
          fontSize: options?.compact ? "0.82em" : "0.86em",
          fontWeight: 760,
          letterSpacing: "0.01em",
        }}
      >
        {renderInlineMarkdown(headingMatch[1])}
      </p>
    );
  }

  if (isList) {
    const ordered = Boolean(listMatches[0]?.[2]?.match(/^\d/));
    const items = listMatches.map((match) => match?.[3] ?? "");
    const ListTag = ordered ? "ol" : "ul";

    return (
      <ListTag
        key={index}
        style={{
          display: "grid",
          gap: options?.compact ? "0.22rem" : "0.35rem",
          listStylePosition: "outside",
          margin: 0,
          paddingLeft: options?.compact ? "0.95rem" : "1.1rem",
        }}
      >
        {items.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`} style={{ paddingLeft: "0.12rem" }}>
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>
    );
  }

  return (
    <p key={index} style={{ margin: 0, whiteSpace: "pre-wrap" }}>
      {lines.map((line, lineIndex) => (
        <Fragment key={`${index}-${lineIndex}`}>
          {renderInlineMarkdown(line)}
          {lineIndex < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </p>
  );
}

export function MarkdownContent({
  content,
  className,
  style,
  highlightFinalQuestion = false,
  questionAccent,
  questionBackground,
  questionBorder,
  compact = false,
}: MarkdownContentProps) {
  const blocks = normalizeMarkdownLayout(content).split(/\n{2,}/).filter(Boolean);

  if (blocks.length === 0) return null;

  const finalQuestionIndex = highlightFinalQuestion && isLikelyFinalQuestion(blocks[blocks.length - 1])
    ? blocks.length - 1
    : -1;

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gap: compact ? "0.46rem" : "0.65rem",
        ...style,
      }}
    >
      {blocks.map((block, index) =>
        renderBlock(block, index, {
          isFinalQuestion: index === finalQuestionIndex,
          questionAccent,
          questionBackground,
          questionBorder,
          compact,
        }),
      )}
    </div>
  );
}

import { EditorError } from "@/i18n/editor";

export type SpecialFileId =
  | "layout"
  | "template"
  | "loading"
  | "error"
  | "not-found"
  | "default"
  | "route";

const ROUTE_SEG_PATTERNS: RegExp[] = [
  /^[a-z0-9][a-z0-9-_]*$/,
  /^\[[a-zA-Z][a-zA-Z0-9]*\]$/,
  /^\[\.\.\.[a-zA-Z][a-zA-Z0-9]*\]$/,
  /^\[\[\.\.\.[a-zA-Z][a-zA-Z0-9]*\]\]$/,
  /^\([a-zA-Z][a-zA-Z0-9-_]*\)$/,
  /^@[a-zA-Z][a-zA-Z0-9]*$/,
];

export function validateRoutePath(input: string): EditorError | null {
  const cleaned = String(input || "").trim().replace(/^\/+|\/+$/g, "");
  if (cleaned === "") return new EditorError("pathEmpty");
  for (const seg of cleaned.split("/").map((s) => s.trim())) {
    if (seg === "" || seg === "." || seg === "..") return new EditorError("badSegment", { seg });
    if (!ROUTE_SEG_PATTERNS.some((re) => re.test(seg))) return new EditorError("badName", { seg });
  }
  return null;
}

export type SpecialFile = {
  id: SpecialFileId;
  filename: string;
  title: string;
  docPath: string;
  example: string;
};

export const SPECIAL_FILES: SpecialFile[] = [
  {
    id: "layout",
    filename: "layout.tsx",
    title: "layout.js",
    docPath: "app/api-reference/file-conventions/layout",
    example: `export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}
`,
  },
  {
    id: "template",
    filename: "template.tsx",
    title: "template.js",
    docPath: "app/api-reference/file-conventions/template",
    example: `export default function Template({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
`,
  },
  {
    id: "loading",
    filename: "loading.tsx",
    title: "loading.js",
    docPath: "app/api-reference/file-conventions/loading",
    example: `export default function Loading() {
  return <p>Loading...</p>;
}
`,
  },
  {
    id: "error",
    filename: "error.tsx",
    title: "error.js",
    docPath: "app/api-reference/file-conventions/error",
    example: `"use client"; // error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => retry()}>Try again</button>
    </div>
  );
}
`,
  },
  {
    id: "not-found",
    filename: "not-found.tsx",
    title: "not-found.js",
    docPath: "app/api-reference/file-conventions/not-found",
    example: `import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  );
}
`,
  },
  {
    id: "default",
    filename: "default.tsx",
    title: "default.js",
    docPath: "app/api-reference/file-conventions/default",
    example: `import { notFound } from "next/navigation";

export default function Default() {
  notFound();
}
`,
  },
  {
    id: "route",
    filename: "route.ts",
    title: "route.js",
    docPath: "app/api-reference/file-conventions/route",
    example: `export async function GET() {
  return Response.json({ message: "Hello World" });
}
`,
  },
];

export const SPECIAL_FILE_MAP: Record<SpecialFileId, SpecialFile> =
  Object.fromEntries(SPECIAL_FILES.map((f) => [f.id, f])) as Record<
    SpecialFileId,
    SpecialFile
  >;

// special files that can be opened in the /_preview route and edited like a page
export const PREVIEW_PATH = "/_preview";
export const EDITABLE_KINDS: SpecialFileId[] = [
  "layout",
  "template",
  "loading",
  "error",
  "not-found",
];

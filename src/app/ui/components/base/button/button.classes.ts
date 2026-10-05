// class data for Button — edited by the component editor; Tailwind scans this file
export const buttonClasses = {
  "base": "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent cursor-pointer select-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none",
  "size": {
    "sm": "h-8 px-3",
    "md": "h-9 px-4",
    "lg": "h-10 px-6",
    "icon": "h-9 w-9 p-0"
  },
  "styles": {
    "solid": {
      "accent": "bg-accent text-(--accent-foreground) hover:bg-accent/90",
      "neutral": "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200",
      "danger": "bg-(--danger) text-(--danger-foreground) hover:bg-(--danger)/90"
    },
    "soft": {
      "accent": "bg-accent/10 text-accent hover:bg-accent/20",
      "neutral": "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
      "danger": "bg-(--danger)/10 text-(--danger) hover:bg-(--danger)/20"
    },
    "outline": {
      "accent": "border-accent text-accent hover:bg-accent/10",
      "neutral": "border-slate-300 text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800",
      "danger": "border-(--danger) text-(--danger) hover:bg-(--danger)/10"
    },
    "ghost": {
      "accent": "text-accent hover:bg-accent/10",
      "neutral": "text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
      "danger": "text-(--danger) hover:bg-(--danger)/10"
    },
    "link": {
      "accent": "text-accent underline-offset-4 hover:underline",
      "neutral": "text-slate-900 underline-offset-4 hover:underline dark:text-slate-100",
      "danger": "text-(--danger) underline-offset-4 hover:underline"
    },
    "fdsfdsfdsfdsf": {
      "accent": "bg-blue-600 hover:bg-blue-700 text-white",
      "neutral": "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200",
      "danger": "bg-red-600 text-white hover:bg-red-700"
    },
    "fdsfds": {
      "accent": "bg-blue-600 hover:bg-blue-700 text-white",
      "neutral": "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200",
      "danger": "bg-red-600 text-white hover:bg-red-700"
    }
  }
} as const;

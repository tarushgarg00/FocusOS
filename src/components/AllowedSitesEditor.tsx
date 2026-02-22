import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SITE_CATEGORIES } from "@/lib/analytics";

export interface AllowedSitesValue {
  categories: string[];
  customSites: string[];
}

interface AllowedSitesEditorProps {
  value: AllowedSitesValue;
  onChange: (value: AllowedSitesValue) => void;
}

function normalizeDomain(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const host = withoutProtocol.split("/")[0] ?? "";
  return host.replace(/^www\./, "");
}

export default function AllowedSitesEditor({ value, onChange }: AllowedSitesEditorProps) {
  const [domainInput, setDomainInput] = useState("");

  const categories = useMemo(
    () => Object.entries(SITE_CATEGORIES).map(([key, details]) => ({ key, ...details })),
    []
  );

  const toggleCategory = (category: string) => {
    const nextCategories = value.categories.includes(category)
      ? value.categories.filter((entry) => entry !== category)
      : [...value.categories, category];
    onChange({ ...value, categories: nextCategories });
  };

  const addCustomSite = () => {
    const domain = normalizeDomain(domainInput);
    if (!domain) {
      return;
    }

    if (!value.customSites.includes(domain)) {
      onChange({ ...value, customSites: [...value.customSites, domain] });
    }
    setDomainInput("");
  };

  const removeCustomSite = (site: string) => {
    onChange({ ...value, customSites: value.customSites.filter((entry) => entry !== site) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const active = value.categories.includes(category.key);
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => toggleCategory(category.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground border border-border"
              }`}
            >
              <span className="mr-1">{category.emoji}</span>
              {category.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={domainInput}
          onChange={(event) => setDomainInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomSite();
            }
          }}
          placeholder="Add domain (e.g. github.com)"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={addCustomSite}
          className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Add
        </button>
      </div>

      {value.customSites.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.customSites.map((site) => (
            <span key={site} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-foreground">
              {site}
              <button type="button" onClick={() => removeCustomSite(site)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

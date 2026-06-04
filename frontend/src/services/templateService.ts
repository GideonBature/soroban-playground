/**
 * Service to load and manage template metadata from contract directories
 */

import { TemplateMetadata } from "@/types/template";

export async function loadTemplateMetadata(): Promise<TemplateMetadata[]> {
  try {
    const response = await fetch("/api/templates/metadata");
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error loading templates:", error);
    return generateMockMetadata();
  }
}

export function generateMockMetadata(): TemplateMetadata[] {
  return [
    {
      id: "hello-world",
      name: "Hello World",
      dirName: "hello-world",
      description: "Minimal Soroban contract example",
      category: "Utilities",
      functionalities: ["Basic"],
      complexity: "Beginner",
      deploymentStatus: "Testnet",
      dependencies: [],
      tags: ["minimal", "example"],
      features: ["Simple function call"],
    },
    {
      id: "counter",
      name: "Counter",
      dirName: "counter",
      description: "Simple counter with state management",
      category: "Utilities",
      functionalities: ["Basic", "State Management"],
      complexity: "Beginner",
      deploymentStatus: "Testnet",
      dependencies: [],
      tags: ["state", "storage"],
      features: ["State persistence"],
    },
    {
      id: "stablecoin",
      name: "Stablecoin",
      dirName: "stablecoin",
      description: "Algorithmic stablecoin with collateral",
      category: "DeFi",
      functionalities: ["Token Operations", "Advanced"],
      complexity: "Advanced",
      deploymentStatus: "Production",
      dependencies: [{ name: "soroban-sdk", version: "^21.0" }],
      tags: ["defi", "collateral"],
      features: ["Minting", "Burning", "Price feed"],
    },
  ];
}

export function filterTemplates(
  templates: TemplateMetadata[],
  searchQuery: string,
  categories: string[],
  functionalities: string[],
  complexityLevels: string[],
  deploymentStatuses: string[],
  dependencies: string[]
): TemplateMetadata[] {
  return templates.filter((template) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matches = template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query));
      if (!matches) return false;
    }

    if (categories.length > 0 && !categories.includes(template.category)) return false;
    if (functionalities.length > 0) {
      const has = functionalities.some(func => template.functionalities.includes(func as any));
      if (!has) return false;
    }
    if (complexityLevels.length > 0 && !complexityLevels.includes(template.complexity)) return false;
    if (deploymentStatuses.length > 0 && !deploymentStatuses.includes(template.deploymentStatus)) return false;
    if (dependencies.length > 0) {
      const depNames = template.dependencies.map(d => d.name);
      const has = dependencies.every(dep => depNames.includes(dep));
      if (!has) return false;
    }

    return true;
  });
}

export function generateSuggestions(templates: TemplateMetadata[]) {
  const suggestions = new Map<string, string>();

  templates.forEach((template) => {
    suggestions.set(template.category, "category");
    template.functionalities.forEach((func) => suggestions.set(func, "functionality"));
    template.tags.forEach((tag) => suggestions.set(tag, "tag"));
    template.dependencies.forEach((dep) => suggestions.set(dep.name, "dependency"));
  });

  return Array.from(suggestions.entries())
    .map(([label, category]) => ({ label, category }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

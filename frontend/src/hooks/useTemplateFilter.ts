"use client";

import { useCallback, useReducer, useMemo } from "react";
import { FilterCriteria, TemplateMetadata } from "@/types/template";
import { filterTemplates } from "@/services/templateService";

const initialCriteria: FilterCriteria = {
  categories: [],
  functionalities: [],
  complexityLevels: [],
  deploymentStatuses: [],
  searchQuery: "",
  dependencies: [],
};

const initialState = { criteria: initialCriteria, resultsCount: 0 };

function filterReducer(state, action) {
  switch (action.type) {
    case "SET_SEARCH":
      return {
        ...state,
        criteria: { ...state.criteria, searchQuery: action.payload },
      };
    case "TOGGLE_CATEGORY":
      return {
        ...state,
        criteria: {
          ...state.criteria,
          categories: state.criteria.categories.includes(action.payload)
            ? state.criteria.categories.filter(c => c !== action.payload)
            : [...state.criteria.categories, action.payload],
        },
      };
    case "RESET_FILTERS":
      return { ...state, criteria: initialCriteria };
    default:
      return state;
  }
}

export function useTemplateFilter(templates: TemplateMetadata[]) {
  const [filterState, dispatch] = useReducer(filterReducer, initialState);

  const filteredTemplates = useMemo(
    () => filterTemplates(
      templates,
      filterState.criteria.searchQuery,
      filterState.criteria.categories,
      filterState.criteria.functionalities,
      filterState.criteria.complexityLevels,
      filterState.criteria.deploymentStatuses,
      filterState.criteria.dependencies
    ),
    [templates, filterState.criteria]
  );

  return {
    filterState,
    filteredTemplates,
    setSearch: (query: string) => dispatch({ type: "SET_SEARCH", payload: query }),
    toggleCategory: (cat: string) => dispatch({ type: "TOGGLE_CATEGORY", payload: cat }),
    resetFilters: () => dispatch({ type: "RESET_FILTERS" }),
  };
}

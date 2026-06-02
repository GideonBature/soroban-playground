import { render, screen, fireEvent } from "@testing-library/react";
import FavoritesFilter from "../../components/FavoritesFilter";
import type { FavoritesFilterState } from "../../components/FavoritesFilter";

const categories = ["Basics", "Tokens", "Finance"];
const tags = ["defi", "beginner", "nft"];

function defaultFilters(overrides: Partial<FavoritesFilterState> = {}): FavoritesFilterState {
  return { categories: [], tags: [], ...overrides };
}

describe("FavoritesFilter", () => {
  it("renders category and tag pills", () => {
    render(
      <FavoritesFilter
        availableCategories={categories}
        availableTags={tags}
        filters={defaultFilters()}
        onFiltersChange={jest.fn()}
      />
    );
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("defi")).toBeInTheDocument();
  });

  it("calls onFiltersChange with added category when pill is clicked", () => {
    const onChange = jest.fn();
    render(
      <FavoritesFilter
        availableCategories={categories}
        availableTags={tags}
        filters={defaultFilters()}
        onFiltersChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("Tokens"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ["Tokens"] })
    );
  });

  it("calls onFiltersChange removing category when active pill is clicked again", () => {
    const onChange = jest.fn();
    render(
      <FavoritesFilter
        availableCategories={categories}
        availableTags={tags}
        filters={defaultFilters({ categories: ["Finance"] })}
        onFiltersChange={onChange}
      />
    );
    // clicking the active pill should deselect
    fireEvent.click(screen.getByText(/Finance/));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ categories: [] })
    );
  });

  it("calls onFiltersChange with added tag when tag pill is clicked", () => {
    const onChange = jest.fn();
    render(
      <FavoritesFilter
        availableCategories={categories}
        availableTags={tags}
        filters={defaultFilters()}
        onFiltersChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("nft"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["nft"] })
    );
  });

  it("shows active filter count badge", () => {
    render(
      <FavoritesFilter
        availableCategories={categories}
        availableTags={tags}
        filters={defaultFilters({ categories: ["Basics"], tags: ["defi"] })}
        onFiltersChange={jest.fn()}
      />
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows Clear button when filters are active and resets on click", () => {
    const onChange = jest.fn();
    render(
      <FavoritesFilter
        availableCategories={categories}
        availableTags={tags}
        filters={defaultFilters({ categories: ["Basics"] })}
        onFiltersChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenCalledWith({ categories: [], tags: [] });
  });

  it("does not show Clear button when no filters active", () => {
    render(
      <FavoritesFilter
        availableCategories={categories}
        availableTags={tags}
        filters={defaultFilters()}
        onFiltersChange={jest.fn()}
      />
    );
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("shows empty state message when no categories or tags are provided", () => {
    render(
      <FavoritesFilter
        availableCategories={[]}
        availableTags={[]}
        filters={defaultFilters()}
        onFiltersChange={jest.fn()}
      />
    );
    expect(screen.getByText(/no filters available/i)).toBeInTheDocument();
  });
});

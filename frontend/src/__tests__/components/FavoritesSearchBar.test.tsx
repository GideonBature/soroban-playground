import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import FavoritesSearchBar from "../../components/FavoritesSearchBar";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => localStorageMock.clear());

jest.useFakeTimers();

describe("FavoritesSearchBar", () => {
  it("renders the search input", () => {
    render(<FavoritesSearchBar onSearch={jest.fn()} />);
    expect(screen.getByRole("textbox", { name: /search favorites/i })).toBeInTheDocument();
  });

  it("calls onSearch with debounced query on input", async () => {
    const onSearch = jest.fn();
    render(<FavoritesSearchBar onSearch={onSearch} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "token" } });
    act(() => jest.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledWith("token");
  });

  it("calls onSearch with empty string when input is cleared", () => {
    const onSearch = jest.fn();
    render(<FavoritesSearchBar onSearch={onSearch} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "token" } });
    act(() => jest.advanceTimersByTime(300));

    fireEvent.change(input, { target: { value: "" } });
    act(() => jest.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenLastCalledWith("");
  });

  it("shows clear button when query is non-empty and clears on click", () => {
    const onSearch = jest.fn();
    render(<FavoritesSearchBar onSearch={onSearch} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "hello" } });
    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect((input as HTMLInputElement).value).toBe("");
    expect(onSearch).toHaveBeenLastCalledWith("");
  });

  it("submits on form submit and saves to history", () => {
    const onSearch = jest.fn();
    render(<FavoritesSearchBar onSearch={onSearch} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "escrow" } });
    fireEvent.submit(input.closest("form")!);

    expect(onSearch).toHaveBeenCalledWith("escrow");

    const saved = JSON.parse(localStorage.getItem("favorites_search_history") ?? "[]");
    expect(saved).toContain("escrow");
  });

  it("filters suggestions by current query", async () => {
    const suggestions = ["Escrow", "Fungible Token", "NFT Mint"];
    render(<FavoritesSearchBar onSearch={jest.fn()} suggestions={suggestions} />);
    const input = screen.getByRole("textbox");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "esc" } });

    await screen.findByText("Escrow");
    expect(screen.queryByText("NFT Mint")).not.toBeInTheDocument();
  });

  it("shows recent history on focus when input is empty", () => {
    localStorage.setItem(
      "favorites_search_history",
      JSON.stringify(["oracle", "vesting"])
    );
    render(<FavoritesSearchBar onSearch={jest.fn()} />);
    const input = screen.getByRole("textbox");

    fireEvent.focus(input);

    expect(screen.getByText("oracle")).toBeInTheDocument();
    expect(screen.getByText("vesting")).toBeInTheDocument();
  });

  it("removes item from history when X is clicked", () => {
    localStorage.setItem("favorites_search_history", JSON.stringify(["oracle"]));
    render(<FavoritesSearchBar onSearch={jest.fn()} />);

    fireEvent.focus(screen.getByRole("textbox"));

    const removeBtn = screen.getByRole("button", { name: /remove oracle from history/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText("oracle")).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem("favorites_search_history") ?? "[]");
    expect(saved).not.toContain("oracle");
  });
});
